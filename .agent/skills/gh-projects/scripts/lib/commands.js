/**
 * All project board commands.
 *
 * Each public function receives a `meta` object from auto-discovery
 * containing { owner, repo, projectNumber, projectId }.
 *
 * Shared internal helpers (fetchProjectData, buildValueGraphQL, updateField)
 * exist to eliminate duplication between cmdSet (single field) and cmdGroom
 * (batch all fields). Any new command that touches project fields should
 * reuse these helpers rather than duplicating GraphQL.
 */
const { quotePS, runGraphQL, gh } = require('./gh');

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/**
 * Fetches all project items and field definitions in a single round-trip.
 *
 * Returns the projectV2 node (with id, items, fields) or null on failure.
 * Both cmdSet and cmdGroom call this once and then iterate over fields,
 * avoiding redundant API calls when updating multiple fields.
 */
function fetchProjectData(meta) {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          items(first: 100) {
            nodes {
              id
              content { ... on Issue { number } }
            }
          }
          fields(first: 30) {
            nodes {
              ... on ProjectV2Field { id name }
              ... on ProjectV2IterationField { id name }
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query, { owner: meta.owner, number: meta.projectNumber });
  return result?.data?.user?.projectV2 || null;
}

/**
 * Builds the inline GraphQL value literal for a field mutation.
 *
 * The GitHub GraphQL API expects `ProjectV2PropertyValue` as an input type,
 * but `gh` CLI cannot pass complex input objects as variables. We work around
 * this by inlining the value directly into the mutation string.
 *
 * For single-select fields, resolves the option name to its ID.
 * For text fields, escapes double quotes to prevent query injection.
 *
 * @returns A GraphQL literal string like `{singleSelectOptionId: "..."}`, or null if the option name is invalid.
 */
function buildValueGraphQL(field, value) {
  if (field.options) {
    // Single-select: resolve human-readable name -> internal option ID
    const option = field.options.find(o => o.name === value);
    if (!option) return null;
    return `{singleSelectOptionId: "${option.id}"}`;
  }
  // Text field: inline the value with escaped quotes
  const safeText = value.replace(/"/g, '\\"');
  return `{text: "${safeText}"}`;
}

/**
 * Executes a single field-value mutation with the value inlined.
 *
 * @returns true on success, false on failure.
 */
function updateField(projectId, itemId, fieldId, valueGraphQL) {
  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: ${valueGraphQL}
      }) {
        projectV2Item { id }
      }
    }
  `;

  const result = runGraphQL(mutation, { projectId, itemId, fieldId });
  return !!result?.data?.updateProjectV2ItemFieldValue?.projectV2Item?.id;
}

// ─── Commands ───────────────────────────────────────────────────────────────

/**
 * Fetches and displays the current board as a formatted table.
 *
 * Queries all items with their field values (Status, Priority) and labels,
 * then renders a fixed-width ASCII table to stdout.
 */
function cmdPulse(meta) {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 100) {
            nodes {
              content {
                ... on Issue {
                  number
                  title
                  labels(first: 5) { nodes { name } }
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query, { owner: meta.owner, number: meta.projectNumber });
  if (!result) { console.error('Failed to fetch board.'); process.exit(1); }

  // Filter to items that have issue content (excludes drafts, PRs without numbers)
  const items = result.data.user.projectV2.items.nodes.filter(n => n.content?.number);

  if (items.length === 0) {
    console.log('No items on the board.');
    return;
  }

  // Transform raw GraphQL nodes into flat row objects for display
  const rows = items.map(item => {
    const fields = item.fieldValues.nodes;
    const getField = (name) => {
      const f = fields.find(fv => fv.field?.name === name);
      return f?.name || f?.text || '';
    };

    return {
      ID: item.content.number,
      Title: item.content.title.length > 30 ? item.content.title.slice(0, 27) + '...' : item.content.title,
      Status: getField('Status'),
      Priority: getField('Priority'),
      Labels: (item.content.labels?.nodes || []).map(l => l.name).join(', '),
    };
  });

  // Render as fixed-width ASCII table
  const cols = ['ID', 'Title', 'Status', 'Priority', 'Labels'];
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c]).length)));

  const header = cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');

  console.log(header);
  console.log(separator);
  rows.forEach(r => {
    console.log(cols.map((c, i) => String(r[c]).padEnd(widths[i])).join('  '));
  });
}

/** Adds an issue to the GitHub Project board by its issue number. */
function cmdAdd(meta, issueNumber) {
  const issueRaw = gh(`issue view ${issueNumber} --repo "${meta.owner}/${meta.repo}" --json id`);
  if (!issueRaw) { console.error(`Issue #${issueNumber} not found.`); process.exit(1); }
  const issueId = JSON.parse(issueRaw).id;

  const query = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }
  `;

  const result = runGraphQL(query, { projectId: meta.projectId, contentId: issueId });
  if (result?.data?.addProjectV2ItemById?.item?.id) {
    console.log(`Added Issue #${issueNumber} to Project #${meta.projectNumber}`);
  } else {
    console.error('Failed to add item.');
    process.exit(1);
  }
}

/**
 * Updates a single board field for an issue.
 *
 * Use --groom instead when setting multiple fields at once — it fetches
 * project data once instead of once per field.
 */
function cmdSet(meta, issueNumber, fieldName, value) {
  const projectData = fetchProjectData(meta);
  if (!projectData) {
    console.error(`Project #${meta.projectNumber} not found or not accessible.`);
    process.exit(1);
  }

  const item = projectData.items.nodes.find(n => n.content?.number === issueNumber);
  if (!item) {
    console.error(`Issue #${issueNumber} not found on the board. Add it first using --add.`);
    process.exit(1);
  }

  const field = projectData.fields.nodes.find(f => f.name === fieldName);
  if (!field) {
    const available = projectData.fields.nodes.map(f => f.name).filter(Boolean).join(', ');
    console.error(`Field '${fieldName}' not found. Available: ${available}`);
    process.exit(1);
  }

  const valueGraphQL = buildValueGraphQL(field, value);
  if (!valueGraphQL) {
    const available = field.options.map(o => o.name).join(', ');
    console.error(`Option '${value}' not found for '${fieldName}'. Available: ${available}`);
    process.exit(1);
  }

  if (updateField(projectData.id, item.id, field.id, valueGraphQL)) {
    console.log(`Set ${fieldName} to '${value}' for Issue #${issueNumber}`);
  } else {
    console.error('Failed to update field.');
    process.exit(1);
  }
}

/**
 * Sets all mandatory metadata for an issue in a single invocation.
 *
 * This is the primary grooming tool. It:
 *   1. Assigns the issue to @me (always)
 *   2. Adds a label, auto-creating it if it doesn't exist yet
 *   3. Sets project board fields (Priority, Size, Agent, Status) in one batch
 *
 * Fetches project data exactly once regardless of how many fields are updated,
 * making it significantly faster than calling --set multiple times.
 *
 * Produces a structured report showing what succeeded and what failed,
 * so partial failures don't silently drop data.
 */
function cmdGroom(meta, issueNumber, groomOpts) {
  const results = [];
  const errors = [];

  // ── Step 1: Assign to @me (always runs) ──
  const assignResult = gh(`issue edit ${issueNumber} --repo "${meta.owner}/${meta.repo}" --add-assignee "@me"`);
  if (assignResult !== null) {
    results.push('Assignee: @me');
  } else {
    errors.push('Assignee: failed to assign @me');
  }

  // ── Step 2: Add label with auto-creation fallback ──
  if (groomOpts.label) {
    const labelResult = gh(`issue edit ${issueNumber} --repo "${meta.owner}/${meta.repo}" --add-label ${quotePS(groomOpts.label)}`);
    if (labelResult !== null) {
      results.push(`Label: ${groomOpts.label}`);
    } else {
      // Label doesn't exist — create it with a sensible default color, then retry
      const colors = { chore: 'ededed', feat: 'a2eeef', bug: 'd73a4a', docs: '0075ca', enhancement: 'a2eeef' };
      const color = colors[groomOpts.label] || '6f42c1';
      gh(`label create ${quotePS(groomOpts.label)} --repo "${meta.owner}/${meta.repo}" --color ${quotePS(color)} --force`);
      const retry = gh(`issue edit ${issueNumber} --repo "${meta.owner}/${meta.repo}" --add-label ${quotePS(groomOpts.label)}`);
      if (retry !== null) {
        results.push(`Label: ${groomOpts.label} (created)`);
      } else {
        errors.push(`Label: failed to set '${groomOpts.label}'`);
      }
    }
  }

  // ── Step 3: Set project fields in one batch ──
  // Single API call to fetch all field definitions and item IDs
  const projectData = fetchProjectData(meta);
  if (!projectData) {
    errors.push('Project fields: could not access project');
    printGroomReport(issueNumber, results, errors);
    return;
  }

  const item = projectData.items.nodes.find(n => n.content?.number === issueNumber);
  if (!item) {
    errors.push('Project fields: issue not on board (use --add first)');
    printGroomReport(issueNumber, results, errors);
    return;
  }

  // Map CLI flags to board field names
  const fieldUpdates = [
    { flag: 'priority', fieldName: 'Priority' },
    { flag: 'size', fieldName: 'Size' },
    { flag: 'agent', fieldName: 'Agent' },
    { flag: 'status', fieldName: 'Status' },
  ];

  for (const { flag, fieldName } of fieldUpdates) {
    const value = groomOpts[flag];
    if (!value) continue;

    const field = projectData.fields.nodes.find(f => f.name === fieldName);
    if (!field) {
      errors.push(`${fieldName}: field not found on board`);
      continue;
    }

    const valueGraphQL = buildValueGraphQL(field, value);
    if (!valueGraphQL) {
      const available = field.options.map(o => o.name).join(', ');
      errors.push(`${fieldName}: '${value}' not found (available: ${available})`);
      continue;
    }

    if (updateField(projectData.id, item.id, field.id, valueGraphQL)) {
      results.push(`${fieldName}: ${value}`);
    } else {
      errors.push(`${fieldName}: failed to set '${value}'`);
    }
  }

  printGroomReport(issueNumber, results, errors);
}

/** Renders the groom results as a structured success/failure report. */
function printGroomReport(issueNumber, results, errors) {
  console.log(`\n--- Groom Report: Issue #${issueNumber} ---`);
  if (results.length > 0) {
    console.log('Set:');
    results.forEach(r => console.log(`  + ${r}`));
  }
  if (errors.length > 0) {
    console.log('Failed:');
    errors.forEach(e => console.log(`  ! ${e}`));
  }
  if (errors.length === 0) {
    console.log('All metadata set successfully.');
  }
  console.log('');
}

/** Links a child issue as a native sub-issue of a parent issue. */
function cmdLinkChild(meta, parentNumber, childNumber) {
  const parentRaw = gh(`issue view ${parentNumber} --repo "${meta.owner}/${meta.repo}" --json id`);
  const childRaw = gh(`issue view ${childNumber} --repo "${meta.owner}/${meta.repo}" --json id`);

  if (!parentRaw) { console.error(`Parent Issue #${parentNumber} not found.`); process.exit(1); }
  if (!childRaw) { console.error(`Child Issue #${childNumber} not found.`); process.exit(1); }

  const parentId = JSON.parse(parentRaw).id;
  const childId = JSON.parse(childRaw).id;

  const mutation = `
    mutation($parentId: ID!, $childId: ID!) {
      addSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
        issue { id title }
      }
    }
  `;

  const result = runGraphQL(mutation, { parentId, childId });
  if (result?.data?.addSubIssue?.issue?.id) {
    console.log(`Linked Issue #${childNumber} as sub-issue of #${parentNumber}`);
  } else {
    console.error('Failed to link sub-issue.');
    process.exit(1);
  }
}

/** Lists all GitHub Projects for the given owner. */
function cmdList(owner) {
  const raw = gh(`project list --owner ${quotePS(owner)}`);
  if (raw) console.log(raw);
}

module.exports = { cmdPulse, cmdAdd, cmdSet, cmdGroom, cmdLinkChild, cmdList };
