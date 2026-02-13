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
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { gh, runGraphQL, quotePS, runGit } = require('./gh');

const CACHE_FILE = path.join('.agent', '.cache_project_schema.json');
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Shared Helpers ─────────────────────────────────────────────────────────

/**
 * Fetches all project items and field definitions in a single round-trip.
 *
 * Returns the projectV2 node (with id, items, fields) or null on failure.
 * Both cmdSet and cmdGroom call this once and then iterate over fields,
 * avoiding redundant API calls when updating multiple fields.
 */
function fetchProjectData(meta) {
  // Check cache first
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const stats = fs.statSync(CACHE_FILE);
      const isFresh = (Date.now() - stats.mtimeMs) < CACHE_TTL_MS;
      if (isFresh) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      }
    }
  } catch (e) {
    // Fallback to fresh fetch on cache error
  }

  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue { number }
                ... on PullRequest { number }
              }
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
  const project = result?.data?.user?.projectV2 || null;

  if (project) {
    try {
      if (!fs.existsSync(path.dirname(CACHE_FILE))) {
        fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(project, null, 2));
    } catch (e) {
      // Ignore cache write errors
    }
  }

  return project;
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
function cmdPulse(meta, jsonMode = false) {
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
                  url
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
  if (!result) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: 'Failed to fetch board' }));
    } else {
      console.error('Failed to fetch board.');
    }
    process.exit(1);
  }

  // Filter to items that have issue content (excludes drafts, PRs without numbers)
  const items = result.data.user.projectV2.items.nodes.filter(n => n.content?.number);

  if (items.length === 0) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: true, items: [] }));
    } else {
      console.log('No items on the board.');
    }
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
      Title: item.content.title,
      URL: item.content.url,
      Status: getField('Status'),
      Priority: getField('Priority'),
      Labels: (item.content.labels?.nodes || []).map(l => l.name).join(', '),
    };
  });

  if (jsonMode) {
    console.log(JSON.stringify({ success: true, items: rows }));
    return;
  }

  const displayRows = rows.map(r => ({
    ...r,
    Title: r.Title.length > 30 ? r.Title.slice(0, 27) + '...' : r.Title
  }));

  // Render as fixed-width ASCII table
  const cols = ['ID', 'Title', 'Status', 'Priority', 'Labels'];
  const widths = cols.map(c => Math.max(c.length, ...rows.map(r => String(r[c]).length)));

  const header = cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');

  console.log(header);
  console.log(separator);
  rows.forEach((r, i) => {
    console.log(cols.map((c, j) => String(displayRows[i][c]).padEnd(widths[j])).join('  '));
  });
}

/** Adds an issue to the GitHub Project board by its issue number. */
function cmdAdd(meta, issueNumber, jsonMode = false) {
  const issueRaw = gh(`issue view ${issueNumber} --repo "${meta.owner}/${meta.repo}" --json id`);
  if (!issueRaw) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Issue #${issueNumber} not found` }));
    } else {
      console.error(`Issue #${issueNumber} not found.`);
    }
    process.exit(1);
  }
  const issueId = JSON.parse(issueRaw).id;

  const query = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }
  `;

  const result = runGraphQL(query, { projectId: meta.projectId, contentId: issueId });
  const itemId = result?.data?.addProjectV2ItemById?.item?.id;

  if (itemId) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: true, itemId }));
    } else {
      console.log(`Added Issue #${issueNumber} to Project #${meta.projectNumber}`);
    }
    return itemId;
  } else {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: 'Failed to add item to project' }));
    } else {
      console.error('Failed to add item.');
    }
    process.exit(1);
  }
}

/**
 * Updates a single board field for an issue.
 *
 * Use --groom instead when setting multiple fields at once — it fetches
 * project data once instead of once per field.
 */
function cmdSet(meta, issueNumber, fieldName, value, jsonMode = false) {
  const projectData = fetchProjectData(meta);
  if (!projectData) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Project #${meta.projectNumber} not found` }));
    } else {
      console.error(`Project #${meta.projectNumber} not found or not accessible.`);
    }
    process.exit(1);
  }

  const item = projectData.items.nodes.find(n => n.content?.number === issueNumber);
  if (!item) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Issue #${issueNumber} not on board` }));
    } else {
      console.error(`Issue #${issueNumber} not found on the board. Add it first using --add.`);
    }
    process.exit(1);
  }

  const field = projectData.fields.nodes.find(f => f.name === fieldName);
  if (!field) {
    const available = projectData.fields.nodes.map(f => f.name).filter(Boolean).join(', ');
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Field '${fieldName}' not found`, available: projectData.fields.nodes.map(f => f.name).filter(Boolean) }));
    } else {
      console.error(`Field '${fieldName}' not found. Available: ${available}`);
    }
    process.exit(1);
  }

  const valueGraphQL = buildValueGraphQL(field, value);
  if (!valueGraphQL) {
    const available = field.options.map(o => o.name).join(', ');
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Option '${value}' not found for '${fieldName}'`, available: field.options.map(o => o.name) }));
    } else {
      console.error(`Option '${value}' not found for '${fieldName}'. Available: ${available}`);
    }
    process.exit(1);
  }

  if (updateField(projectData.id, item.id, field.id, valueGraphQL)) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: true, issueNumber, fieldName, value }));
    } else {
      console.log(`Set ${fieldName} to '${value}' for Issue #${issueNumber}`);
    }
  } else {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: 'Failed to update field' }));
    } else {
      console.error('Failed to update field.');
    }
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
function cmdGroom(meta, issueNumber, groomOpts, jsonMode = false) {
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
  const projectData = fetchProjectData(meta);
  if (!projectData) {
    errors.push('Project fields: could not access project');
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, errors }));
    } else {
      printGroomReport(issueNumber, results, errors);
    }
    return;
  }

  const item = projectData.items.nodes.find(n => n.content?.number === issueNumber);
  if (!item) {
    errors.push('Project fields: issue not on board (use --add first)');
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, results, errors }));
    } else {
      printGroomReport(issueNumber, results, errors);
    }
    return;
  }

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
      errors.push(`${fieldName}: '${value}' not found`);
      continue;
    }

    if (updateField(projectData.id, item.id, field.id, valueGraphQL)) {
      results.push(`${fieldName}: ${value}`);
    } else {
      errors.push(`${fieldName}: failed to set '${value}'`);
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify({ success: errors.length === 0, results, errors }));
  } else {
    printGroomReport(issueNumber, results, errors);
  }
}

/**
 * Atomically creates a root issue and enrolls it into the project board with 
 * initial metadata in one pass.
 * 
 * Guarantees that if the issue creation succeeds, the metadata (Priority, 
 * Size, Agent) will be applied sequentially. Returns the new issue number 
 * and URL.
 */
function cmdCreateEpic(meta, title, opts, jsonMode = false) {
  if (!jsonMode) console.log(`Creating Epic: ${title}...`);

  // Step 1: CLI Issue Creation
  const repo = `${meta.owner}/${meta.repo}`;
  let createCmd = `issue create --repo "${repo}" --title ${quotePS(title)} --body "Epic: ${title}" --assignee "@me"`;
  if (opts.label) createCmd += ` --label ${quotePS(opts.label)}`;
  
  const issueUrl = gh(createCmd);
  if (!issueUrl) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: 'gh issue create failed' }));
    process.exit(1);
  }
  
  // Parse issue number from URL (e.g., https://github.com/owner/repo/issues/123)
  const issueNumber = parseInt(issueUrl.split('/').pop(), 10);
  const issue = { number: issueNumber, url: issueUrl };

  // Step 2: Add to Project (uses cached schema via fetchProjectData)
  // We use the mutation directly here to avoid double JSON output from cmdAdd
  const issueRaw = gh(`issue view ${issue.number} --repo "${repo}" --json id`);
  const contentId = JSON.parse(issueRaw).id;
  const addMutation = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }
  `;
  const addResult = runGraphQL(addMutation, { projectId: meta.projectId, contentId });
  const itemId = addResult?.data?.addProjectV2ItemById?.item?.id;

  // Step 3: Batch update fields
  const projectData = fetchProjectData(meta);
  const results = [`Issue #${issue.number} created`];
  if (itemId) results.push('Added to project');
  const errors = [];

  if (itemId && projectData) {
    const fieldUpdates = [
      { key: 'priority', fieldName: 'Priority' },
      { key: 'size', fieldName: 'Size' },
      { key: 'agent', fieldName: 'Agent' },
      { key: 'status', fieldName: 'Status' },
    ];

    for (const { key, fieldName } of fieldUpdates) {
      const val = opts[key];
      if (!val) continue;

      const field = projectData.fields.nodes.find(f => f.name === fieldName);
      if (!field) { errors.push(`${fieldName} field not found`); continue; }

      const vGQL = buildValueGraphQL(field, val);
      if (!vGQL) { errors.push(`Invalid option '${val}' for ${fieldName}`); continue; }

      if (updateField(projectData.id, itemId, field.id, vGQL)) {
        results.push(`${fieldName}: ${val}`);
      } else {
        errors.push(`Failed to set ${fieldName}`);
      }
    }
  } else {
    if (!itemId) errors.push('Failed to add item to project board');
    if (!projectData) errors.push('Failed to fetch project metadata for field updates');
  }

  if (jsonMode) {
    console.log(JSON.stringify({
      success: errors.length === 0,
      number: issue.number,
      url: issue.url,
      results,
      errors
    }));
  } else {
    console.log(`\n--- Epic Created: #${issue.number} ---`);
    results.forEach(r => console.log(`  + ${r}`));
    errors.forEach(e => console.log(`  ! ${e}`));
    console.log(`URL: ${issue.url}\n`);
  }
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
function cmdLinkChild(meta, parentNumber, childNumber, jsonMode = false) {
  const parentRaw = gh(`issue view ${parentNumber} --repo "${meta.owner}/${meta.repo}" --json id`);
  const childRaw = gh(`issue view ${childNumber} --repo "${meta.owner}/${meta.repo}" --json id`);

  if (!parentRaw || !childRaw) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: 'Parent or child issue not found' }));
    } else {
      console.error(`Issue #${parentNumber} or #${childNumber} not found.`);
    }
    process.exit(1);
  }

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
    if (jsonMode) {
      console.log(JSON.stringify({ success: true, parentNumber, childNumber }));
    } else {
      console.log(`Linked Issue #${childNumber} as sub-issue of #${parentNumber}`);
    }
  } else {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: 'Failed to link sub-issue' }));
    } else {
      console.error('Failed to link sub-issue.');
    }
    process.exit(1);
  }
}

/** Lists all GitHub Projects for the given owner. */
function cmdList(owner, jsonMode = false) {
  const raw = gh(`project list --owner ${quotePS(owner)} --json number,title,url`);
  if (raw) {
    if (jsonMode) {
      console.log(raw);
    } else {
      const projects = JSON.parse(raw);
      console.log(`\nProjects for @${owner}:`);
      projects.forEach(p => console.log(`  #${p.number} ${p.title} (${p.url})`));
    }
  }
}

/**
 * Recursive builder for issue hierarchies (Epics, Stories, Tasks).
 *
 * @returns The ID of the created issue.
 */
function buildTree(node, parentId, meta, jsonMode = false) {
  const repo = `${meta.owner}/${meta.repo}`;
  const title = node.title || 'Untitled';
  const body = node.body || '';

  // Step 1: Create Issue
  const tmpBodyFile = path.join(os.tmpdir(), `gh-body-${Date.now()}.md`);
  fs.writeFileSync(tmpBodyFile, body, 'utf8');

  const createCmd = `gh issue create --repo "${repo}" --title ${quotePS(title)} --body-file ${quotePS(tmpBodyFile)} --assignee "@me"`;
  
  let issueUrl;
  try {
    issueUrl = execSync(createCmd, {
      encoding: 'utf-8',
      shell: 'powershell.exe',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : err.message;
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Failed to create issue: ${title}`, stderr }));
    } else {
      console.error(`Error: Failed to create issue ${title}: ${stderr}`);
    }
    try { fs.unlinkSync(tmpBodyFile); } catch {}
    process.exit(1);
  }
  try { fs.unlinkSync(tmpBodyFile); } catch {}

  const issueNumber = parseInt(issueUrl.split('/').pop(), 10);
  const issue = { number: issueNumber, url: issueUrl };

  if (!jsonMode) console.log(`  + Created: #${issueNumber} ${title}`);

  // Step 2: Hierarchical Linking & Board Enrollment
  if (!parentId) {
    // Root Node (Epic): Add to Project Board
    const itemId = cmdAdd(meta, issue.number, true);

    // Apply metadata (Priority, Size, Agent) if provided
    if (itemId) {
      const projectData = fetchProjectData(meta);
      const fieldUpdates = [
        { key: 'priority', fieldName: 'Priority' },
        { key: 'size', fieldName: 'Size' },
        { key: 'agent', fieldName: 'Agent' },
        { key: 'status', fieldName: 'Status' },
      ];

      for (const { key, fieldName } of fieldUpdates) {
        const val = node[key];
        if (!val) continue;

        const field = projectData.fields.nodes.find(f => f.name === fieldName);
        if (field) {
          const vGQL = buildValueGraphQL(field, val);
          if (vGQL) updateField(projectData.id, itemId, field.id, vGQL);
        }
      }
    }
  } else {
    // Child Node (Story/Task): Link to Parent
    // We use the GraphQL mutation directly to avoid CLI overhead
    const parentRaw = gh(`issue view ${parentId} --repo "${repo}" --json id`);
    const childRaw = gh(`issue view ${issue.number} --repo "${repo}" --json id`);

    if (parentRaw && childRaw) {
      const pId = JSON.parse(parentRaw).id;
      const cId = JSON.parse(childRaw).id;
      const mutation = `
        mutation($parentId: ID!, $childId: ID!) {
          addSubIssue(input: {issueId: $parentId, subIssueId: $childId}) { issue { id } }
        }
      `;
      runGraphQL(mutation, { parentId: pId, childId: cId });
    }
  }

  // Step 3: Recurse for children
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      buildTree(child, issue.number, meta, jsonMode);
    }
  }

  return issue.number;
}

/**
 * Recursively generates a feature hierarchy (Epic -> Story -> Task) from 
 * a structured JSON blueprint.
 * 
 * Guarantees serial creation of issues to preserve hierarchy through parent 
 * linking. Each node in the blueprint can define its own title and 
 * sub-issue children.
 */
function cmdBlueprint(meta, blueprintJson, jsonMode = false) {
  let root;
  try {
    root = JSON.parse(blueprintJson);
  } catch (e) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: 'Invalid Blueprint JSON' }));
    } else {
      console.error('Error: Invalid Blueprint JSON string.');
    }
    process.exit(1);
  }

  if (!jsonMode) console.log('\n--- Executing Blueprint ---');
  const rootNumber = buildTree(root, null, meta, jsonMode);

  if (jsonMode) {
    console.log(JSON.stringify({
      success: true,
      rootId: rootNumber,
      status: "Blueprint Executed"
    }));
  } else {
    console.log(`\nBlueprint success! Root Epic: #${rootNumber}\n`);
  }
}

/**
 * Recursively fetches and displays the hierarchy of an issue and its sub-issues.
 * 
 * Guarantees a sanitized JSON or formatted tree output of the issue 
 * relationships, supporting up to 2 levels of nesting.
 */
function cmdReadTree(meta, issueNumber, jsonMode = false) {
  const query = `
    query($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        issue(number: $number) {
          number
          title
          state
          body
          subIssues(first: 20) {
            nodes {
              number
              title
              state
              body
              subIssues(first: 10) {
                nodes {
                  number
                  title
                  state
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query, {
    owner: meta.owner,
    repo: meta.repo,
    number: parseInt(issueNumber, 10)
  });

  const issue = result?.data?.repository?.issue;

  if (!issue) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Issue #${issueNumber} not found` }));
    } else {
      console.error(`Error: Issue #${issueNumber} not found.`);
    }
    process.exit(1);
  }

  // Sanitization helper
  const sanitize = (node) => {
    const clean = {
      number: node.number,
      title: node.title,
      state: node.state.toLowerCase(),
    };
    if (node.body !== undefined) clean.body = node.body;
    
    if (node.subIssues?.nodes?.length > 0) {
      clean.children = node.subIssues.nodes.map(sanitize);
    }
    return clean;
  };

  const tree = sanitize(issue);

  if (jsonMode) {
    console.log(JSON.stringify({ success: true, tree }));
  } else {
    console.log(`\n--- Issue Tree: #${tree.number} ---`);
    const printNode = (node, indent = '') => {
      console.log(`${indent}${node.state === 'open' ? '[ ]' : '[x]'} #${node.number}: ${node.title}`);
      if (node.children) {
        node.children.forEach(c => printNode(c, indent + '  '));
      }
    };
    printNode(tree);
    console.log('');
  }
}

/**
 * Atomically pushes the current branch and creates a linked Pull Request 
 * for a specific issue.
 * 
 * Guarantees that the PR body contains the "Closes #ID" keyword to automate 
 * project board card movement. Automatically loads pull_request_template.md 
 * if present.
 * 
 * Callers must ensure they are on a branch with changes pushed-ready for 
 * origin.
 */
function cmdShip(meta, issueId, title, options, jsonMode = false) {
  try {
    if (!jsonMode) console.log(`Shipping branch for Issue #${issueId}...`);

    // 1. Git Push (Existing)
    runGit('push -u origin HEAD');
    
    // 2. Determine Body Content
    let bodyContent = options.body;

    if (!bodyContent) {
      // Try to load default template if no body provided
      const templatePath = path.join('.github', 'pull_request_template.md');
      try {
        if (fs.existsSync(templatePath)) {
          bodyContent = fs.readFileSync(templatePath, 'utf-8');
        }
      } catch (e) {
        // Ignore read errors, fall back
      }
    }
    
    // Fallback if still empty
    if (!bodyContent) bodyContent = "Automated PR";

    // 3. Append the Magic Link
    // We MUST append this to trigger the board movement
    const prBody = `${bodyContent}\n\nCloses #${issueId}`;

    // 4. Create PR via GH CLI (No --json support in some versions)
    let cmd = `pr create --title ${quotePS(title)} --body ${quotePS(prBody)}`;
    
    // Append Metadata Flags if they exist
    if (options.reviewer) cmd += ` --reviewer "${options.reviewer}"`;
    if (options.assignee) cmd += ` --assignee "${options.assignee}"`;
    if (options.label)    cmd += ` --label "${options.label}"`;

    const prUrl = gh(cmd);
    
    if (!prUrl) {
      throw new Error("gh pr create failed to return a URL");
    }

    // Parse issue number from URL (e.g., https://github.com/owner/repo/pull/123)
    const prNumber = parseInt(prUrl.split('/').pop(), 10);

    // 4. Output
    const result = { 
      success: true, 
      prNumber, 
      url: prUrl, 
      status: "Shipped & Linked" 
    };

    if (jsonMode) {
      console.log(JSON.stringify(result));
    } else {
      console.log(`\n--- Shipped & Linked ---`);
      console.log(`PR #${prNumber} Created: ${prUrl}\n`);
    }

  } catch (err) {
    // Handle "PR already exists" gracefully
    if (err.message && err.message.includes('already exists')) {
       // Try to find the existing PR URL
       const existingPrRaw = gh(`pr list --head HEAD --json url,number`);
       if (existingPrRaw) {
         try {
           const existingPr = JSON.parse(existingPrRaw)[0];
           if (jsonMode) console.log(JSON.stringify({ success: true, prNumber: existingPr.number, url: existingPr.url, status: "PR Already Exists" }));
           else console.log(`PR already exists: ${existingPr.url}`);
           return;
         } catch (e) {}
       }
       
       if (jsonMode) console.log(JSON.stringify({ success: true, status: "PR Already Exists", warning: err.message }));
       else console.log("PR already exists.");
    } else {
       if (jsonMode) console.log(JSON.stringify({ success: false, error: err.message }));
       else console.error(`Error: ${err.message}`);
       process.exit(1);
    }
  }
}

module.exports = { cmdPulse, cmdAdd, cmdSet, cmdGroom, cmdLinkChild, cmdList, cmdCreateEpic, cmdBlueprint, cmdReadTree, cmdShip };
