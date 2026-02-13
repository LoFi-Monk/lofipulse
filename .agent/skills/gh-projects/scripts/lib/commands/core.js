/**
 * Core Board Management Commands.
 * 
 * This module handles basic CRUD operations for the project board:
 * - Pulse: High-level overview of board status.
 * - Add: Enrolling issues into the project.
 * - Set: Updating specific fields.
 * - Groom: Batch-setting metadata for a single issue.
 * 
 * These commands are used by both humans and automated agents to maintain 
 * basic board state.
 */

const { gh, runGraphQL, quotePS } = require('../gh');
const { fetchProjectData, buildFieldCLIArgs, updateField, invalidateCache } = require('../helpers');

/**
 * Fetches and displays the current board as a formatted table or JSON.
 * 
 * @param {Object} meta - Project metadata.
 * @param {Boolean} jsonMode - If true, returns clean JSON for agent parsing.
 * @param {Boolean} noCache - Force fresh fetch.
 */
function cmdPulse(meta, jsonMode = false, noCache = false) {
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

  const items = result.data.user.projectV2.items.nodes.filter(n => n.content?.number);

  if (items.length === 0) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: true, items: [] }));
    } else {
      console.log('No items on the board.');
    }
    return;
  }

  // Transform raw nodes into flat row objects
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

  // Human-only: Format as ASCII Table
  const displayRows = rows.map(r => ({
    ...r,
    Title: r.Title.length > 30 ? r.Title.slice(0, 27) + '...' : r.Title
  }));

  const cols = ['ID', 'Title', 'Status', 'Priority', 'Labels'];
  const widths = cols.map(c => Math.max(c.length, ...displayRows.map(r => String(r[c]).length)));

  const header = cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  const separator = widths.map(w => '-'.repeat(w)).join('  ');

  console.log(header);
  console.log(separator);
  rows.forEach((r, i) => {
    console.log(cols.map((c, j) => String(displayRows[i][c]).padEnd(widths[j])).join('  '));
  });
}

/** 
 * Enrolls an issue onto the project board. 
 * 
 * Returns the itemId (internal board reference) which is required for 
 * subsequent field updates.
 * 
 * @param {Object} meta - Project metadata.
 * @param {Number} issueNumber - The issue to add.
 * @param {Boolean} jsonMode - Output JSON result.
 * @param {Boolean} silentMode - If true, suppress all output.
 * @returns {String|null} The internal Item ID or null on failure.
 */
function cmdAdd(meta, issueNumber, jsonMode = false, silentMode = false) {
  const issueRaw = gh(`issue view ${issueNumber} --repo "${meta.owner}/${meta.repo}" --json id`);
  if (!issueRaw) {
    if (silentMode) return null;
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Issue #${issueNumber} not found` }));
    } else {
      console.error(`Issue #${issueNumber} not found.`);
    }
    process.exit(1);
  }
  
  const issueUrl = `https://github.com/${meta.owner}/${meta.repo}/issues/${issueNumber}`;
  const res = gh(`project item-add ${meta.projectNumber} --owner "${meta.owner}" --url "${issueUrl}" --format json`);

  if (res) {
    invalidateCache();
    const itemId = JSON.parse(res).id;
    if (!silentMode) {
      if (jsonMode) {
        console.log(JSON.stringify({ success: true, issue: issueNumber, itemId }));
      } else {
        console.log(`Issue #${issueNumber} added to board.`);
      }
    }
    return itemId;
  } else {
    if (!silentMode) {
      if (jsonMode) console.log(JSON.stringify({ success: false, error: 'Failed to add issue' }));
      else console.error(`Failed to add Issue #${issueNumber} to project board.`);
    }
    return null;
  }
}

/** 
 * Updates a single field for an issue already on the board.
 */
function cmdSet(meta, issueNumber, fieldName, value, jsonMode = false, noCache = false) {
  const projectData = fetchProjectData(meta, noCache);
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

  const cliArgs = buildFieldCLIArgs(field, value);
  if (!cliArgs) {
    const available = field.options.map(o => o.name).join(', ');
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Option '${value}' not found for '${fieldName}'`, available: field.options.map(o => o.name) }));
    } else {
      console.error(`Option '${value}' not found for '${fieldName}'. Available: ${available}`);
    }
    process.exit(1);
  }

  if (updateField(projectData.id, item.id, field.id, cliArgs)) {
    invalidateCache();
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
 * Grooming: Apply common metadata (Assignee, Labels, Board fields) in one pass.
 * Optimized to fetch project data once for all field updates.
 */
function cmdGroom(meta, issueNumber, groomOpts, jsonMode = false, noCache = false) {
  const results = [];
  const errors = [];

  // Step 1: Assignment
  const assignResult = gh(`issue edit ${issueNumber} --repo "${meta.owner}/${meta.repo}" --add-assignee "@me"`);
  if (assignResult !== null) results.push('Assignee: @me');
  else errors.push('Assignee: failed to assign @me');

  // Step 2: Labels
  if (groomOpts.label) {
    const labelResult = gh(`issue edit ${issueNumber} --repo "${meta.owner}/${meta.repo}" --add-label ${quotePS(groomOpts.label)}`);
    if (labelResult !== null) {
      results.push(`Label: ${groomOpts.label}`);
    } else {
      // Auto-create missing label
      gh(`label create ${quotePS(groomOpts.label)} --repo "${meta.owner}/${meta.repo}" --color "6f42c1" --force`);
      const retry = gh(`issue edit ${issueNumber} --repo "${meta.owner}/${meta.repo}" --add-label ${quotePS(groomOpts.label)}`);
      if (retry !== null) results.push(`Label: ${groomOpts.label} (created)`);
      else errors.push(`Label: failed to set '${groomOpts.label}'`);
    }
  }

  // Step 3: Board Fields
  const projectData = fetchProjectData(meta, noCache);
  if (!projectData) {
    errors.push('Project fields: could not access project');
    return outputGroomReport(issueNumber, results, errors, jsonMode);
  }

  const item = projectData.items.nodes.find(n => n.content?.number === issueNumber);
  if (!item) {
    errors.push('Project fields: issue not on board (use --add first)');
    return outputGroomReport(issueNumber, results, errors, jsonMode);
  }

  const updates = [
    { key: 'priority', fieldName: 'Priority' },
    { key: 'size', fieldName: 'Size' },
    { key: 'agent', fieldName: 'Agent' },
    { key: 'status', fieldName: 'Status' },
  ];

  for (const { key, fieldName } of updates) {
    const val = groomOpts[key];
    if (!val) continue;

    const field = projectData.fields.nodes.find(f => f.name === fieldName);
    if (!field) { errors.push(`${fieldName}: field missing`); continue; }

    const args = buildFieldCLIArgs(field, val);
    if (!args) { errors.push(`${fieldName}: invalid option '${val}'`); continue; }

    if (updateField(projectData.id, item.id, field.id, args)) {
      results.push(`${fieldName}: ${val}`);
    } else {
      errors.push(`${fieldName}: failed to set`);
    }
  }

  invalidateCache();
  outputGroomReport(issueNumber, results, errors, jsonMode);
}

/** Internal report renderer for cmdGroom. */
function outputGroomReport(issueNumber, results, errors, jsonMode) {
  if (jsonMode) {
    console.log(JSON.stringify({ success: errors.length === 0, results, errors }));
  } else {
    console.log(`\n--- Groom Report: Issue #${issueNumber} ---`);
    if (results.length > 0) {
      console.log('Set:');
      results.forEach(r => console.log(`  + ${r}`));
    }
    if (errors.length > 0) {
      console.log('Failed:');
      errors.forEach(e => console.log(`  ! ${e}`));
    }
    console.log('');
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

module.exports = {
  cmdPulse,
  cmdAdd,
  cmdSet,
  cmdGroom,
  cmdList
};
