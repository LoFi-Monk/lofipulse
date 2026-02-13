/**
 * Composite (Agent-First) Commands.
 * 
 * This module handles high-level workflows designed to minimize token usage 
 * and orchestration overhead for AI agents:
 * - CreateEpic: Create issue + Board Add + Metadata in one pass.
 * - Blueprint: Generate nested hierarchies (Epic -> Story -> Task).
 * - ReadTree: Fetch a full hierarchy of issues in one request.
 * - Ship: Atomic push + PR creation with metadata.
 * - LinkChild: Native sub-issue relationship management.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { gh, runGraphQL, quotePS, runGit } = require('../gh');
const { fetchProjectData, buildFieldCLIArgs, updateField, invalidateCache } = require('../helpers');
const { cmdAdd } = require('./core');

/**
 * Creates a root issue and enrolls it in the project board with metadata.
 */
function cmdCreateEpic(meta, title, opts, jsonMode = false) {
  if (!jsonMode) console.log(`Creating Epic: ${title}...`);

  // Step 1: CLI Issue Creation
  const repo = `${meta.owner}/${meta.repo}`;
  const bodyText = `Epic: ${title}`;
  let createCmd = `issue create --repo "${repo}" --title ${quotePS(title)} --body ${quotePS(bodyText)} --assignee "@me"`;
  if (opts.label) createCmd += ` --label ${quotePS(opts.label)}`;

  const issueUrl = gh(createCmd);
  if (!issueUrl) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: 'gh issue create failed' }));
    process.exit(1);
  }

  const issueNumber = parseInt(issueUrl.split('/').pop(), 10);
  
  // Step 2: Add to Project Board (utilizing purified cmdAdd)
  const itemId = cmdAdd(meta, issueNumber, jsonMode, true);
  if (!itemId) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: 'Failed to add epic to project board' }));
    else console.error('Error: Failed to add epic to project board.');
    process.exit(1);
  }

  // Step 3: Batch update metadata fields
  const projectData = fetchProjectData(meta, opts.noCache);
  const results = [`Issue #${issueNumber} created`, 'Added to project'];
  const errors = [];

  if (projectData) {
    const fields = [
      { key: 'priority', name: 'Priority' },
      { key: 'size', name: 'Size' },
      { key: 'agent', name: 'Agent' },
      { key: 'status', name: 'Status' },
    ];

    for (const { key, name } of fields) {
      if (!opts[key]) continue;
      const fieldDef = projectData.fields.nodes.find(f => f.name === name);
      if (!fieldDef) { errors.push(`${name}: field not found`); continue; }
      const args = buildFieldCLIArgs(fieldDef, opts[key]);
      if (!args) { errors.push(`${name}: invalid option '${opts[key]}'`); continue; }
      
      if (updateField(projectData.id, itemId, fieldDef.id, args)) {
        results.push(`${name}: ${opts[key]}`);
      } else {
        errors.push(`${name}: update failed`);
      }
    }
  }

  invalidateCache();

  if (jsonMode) {
    console.log(JSON.stringify({ success: errors.length === 0, number: issueNumber, url: issueUrl, results, errors }));
  } else {
    console.log(`\n--- Epic Created: #${issueNumber} ---`);
    results.forEach(r => console.log(`  + ${r}`));
    errors.forEach(e => console.log(`  ! ${e}`));
    console.log(`URL: ${issueUrl}\n`);
  }
}

/** 
 * Recursive builder for the Blueprint capability. 
 */
function buildTree(node, parentNumber, meta, jsonMode = false) {
  const repo = `${meta.owner}/${meta.repo}`;
  const title = node.title || 'Untitled';
  const body = node.body || '';

  // Step 1: Create the issue using a temporary body file to handle complex text
  const tmpFile = path.join(os.tmpdir(), `gh-body-${Date.now()}.md`);
  fs.writeFileSync(tmpFile, body, 'utf8');

  try {
    const createCmd = `issue create --repo "${repo}" --title ${quotePS(title)} --body-file ${quotePS(tmpFile)} --assignee "@me"`;
    const issueUrl = gh(createCmd);
    if (!issueUrl) throw new Error('gh returned null');
    
    const issueNumber = parseInt(issueUrl.split('/').pop(), 10);
    if (!jsonMode) console.log(`  + Created: #${issueNumber} ${title}`);

    // Step 2: Handle Board Enrollment or Hierarchical Linking
    if (!parentNumber) {
      // Root EPIC: Add to board
      const itemId = cmdAdd(meta, issueNumber, jsonMode, true);
      if (!itemId) {
        if (jsonMode) console.log(JSON.stringify({ success: false, error: 'Root epic board enrollment failed' }));
        process.exit(1);
      }
      // Apply root metadata
      const projectData = fetchProjectData(meta, node.noCache);
      if (projectData) {
        const fields = [{k:'priority', n:'Priority'}, {k:'size', n:'Size'}, {k:'agent', n:'Agent'}, {k:'status', n:'Status'}];
        for (const f of fields) {
          if (!node[f.k]) continue;
          const def = projectData.fields.nodes.find(fd => fd.name === f.n);
          if (def) {
            const args = buildFieldCLIArgs(def, node[f.k]);
            if (args) updateField(projectData.id, itemId, def.id, args);
          }
        }
        invalidateCache();
      }
    } else {
      // CHILD: Link to Parent via GraphQL
      const parentRaw = gh(`issue view ${parentNumber} --repo "${repo}" --json id`);
      const childRaw = gh(`issue view ${issueNumber} --repo "${repo}" --json id`);
      if (parentRaw && childRaw) {
        const mutation = `mutation($p: ID!, $c: ID!) { addSubIssue(input: {issueId: $p, subIssueId: $c}) { issue { id } } }`;
        runGraphQL(mutation, { p: JSON.parse(parentRaw).id, c: JSON.parse(childRaw).id });
        invalidateCache();
      }
    }

    // Step 3: Recurse
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        buildTree(child, issueNumber, meta, jsonMode);
      }
    }
    return issueNumber;

  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

/** Entry point for Blueprint execution. */
function cmdBlueprint(meta, jsonStr, jsonMode = false) {
  let root;
  try { root = JSON.parse(jsonStr); } catch (e) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: 'Invalid JSON' }));
    else console.error('Error: Invalid JSON.');
    process.exit(1);
  }

  if (!jsonMode) console.log('\n--- Executing Blueprint ---');
  const rootId = buildTree(root, null, meta, jsonMode);

  if (jsonMode) console.log(JSON.stringify({ success: true, rootId }));
  else console.log(`\nBlueprint success! Root: #${rootId}\n`);
}

/** Fetches full sub-issue tree via recursive GraphQL. */
function cmdReadTree(meta, issueNumber, jsonMode = false) {
  const query = `
    query($o: String!, $r: String!, $n: Int!) {
      repository(owner: $o, name: $r) {
        issue(number: $n) {
          number title state body
          subIssues(first: 20) {
            nodes {
              number title state body
              subIssues(first: 10) { nodes { number title state } }
            }
          }
        }
      }
    }
  `;
  const res = runGraphQL(query, { o: meta.owner, r: meta.repo, n: parseInt(issueNumber, 10) });
  const issue = res?.data?.repository?.issue;

  if (!issue) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: 'Not found' }));
    else console.error(`Issue #${issueNumber} not found.`);
    process.exit(1);
  }

  const sanitize = (node) => ({
    number: node.number,
    title: node.title,
    state: node.state,
    ...(node.body !== undefined && { body: node.body }),
    ...(node.subIssues?.nodes?.length > 0 && { children: node.subIssues.nodes.map(sanitize) })
  });
  const tree = sanitize(issue);

  if (jsonMode) console.log(JSON.stringify({ success: true, tree }));
  else {
    const print = (n, indent = '') => {
      console.log(`${indent}${n.state === 'OPEN' ? '○' : '●'} #${n.number} ${n.title}`);
      if (n.children) n.children.forEach(c => print(c, indent + '  '));
    };
    console.log('\n--- Issue Tree ---');
    print(tree);
  }
}

/** Atomic Shipper: Push + PR with Metadata. */
function cmdShip(meta, issueNumber, title, options, jsonMode = false) {
  if (!jsonMode) console.log(`Shipping Issue #${issueNumber}...`);

  try {
    // Stage 1: Push Branch
    const branch = runGit('rev-parse --abbrev-ref HEAD').trim();
    runGit(`push origin ${branch}`);

    // Stage 2: Construct PR Body
    let prBody = options.body || '';
    if (!prBody) {
      const templatePath = path.resolve(process.cwd(), '.github', 'pull_request_template.md');
      if (fs.existsSync(templatePath)) prBody = fs.readFileSync(templatePath, 'utf8');
    }
    prBody = (prBody ? prBody + '\n\n' : '') + `Closes #${issueNumber}`;

    // Stage 3: Create PR using body-file for reliability
    const tmpBody = path.join(os.tmpdir(), `gh-pr-${Date.now()}.md`);
    fs.writeFileSync(tmpBody, prBody, 'utf8');

    let createCmd = `pr create --title ${quotePS(title)} --body-file ${quotePS(tmpBody)}`;
    if (options.label) createCmd += ` --label ${quotePS(options.label)}`;
    if (options.reviewer) createCmd += ` --reviewer ${quotePS(options.reviewer)}`;
    if (options.assignee) createCmd += ` --assignee ${quotePS(options.assignee)}`;

    const prUrl = gh(createCmd);
    try { fs.unlinkSync(tmpBody); } catch {}

    if (prUrl) {
      if (jsonMode) console.log(JSON.stringify({ success: true, prUrl }));
      else console.log(`PR Created: ${prUrl}`);
    } else {
       // Fallback: Check if PR exists
       const existsRaw = gh(`pr list --head ${quotePS(branch)} --json url`);
       const exists = existsRaw ? JSON.parse(existsRaw) : [];
       if (exists.length > 0) {
         if (jsonMode) console.log(JSON.stringify({ success: true, prUrl: exists[0].url, note: 'Existing PR found' }));
         else console.log(`Existing PR found: ${exists[0].url}`);
       } else {
         throw new Error('Failed to create or find PR');
       }
    }
  } catch (err) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: err.message }));
    else console.error(`Ship failed: ${err.message}`);
    process.exit(1);
  }
}

/** Links a child manually. */
function cmdLinkChild(meta, pNum, cNum, jsonMode = false) {
  const pRaw = gh(`issue view ${pNum} --repo "${meta.owner}/${meta.repo}" --json id`);
  const cRaw = gh(`issue view ${cNum} --repo "${meta.owner}/${meta.repo}" --json id`);
  if (!pRaw || !cRaw) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: 'Not found' }));
    process.exit(1);
  }
  const mutation = `mutation($p: ID!, $c: ID!) { addSubIssue(input: {issueId: $p, subIssueId: $c}) { issue { id } } }`;
  const res = runGraphQL(mutation, { p: JSON.parse(pRaw).id, c: JSON.parse(cRaw).id });
  if (res?.data?.addSubIssue?.issue?.id) {
    invalidateCache();
    if (jsonMode) console.log(JSON.stringify({ success: true }));
    else console.log(`Linked #${cNum} to #${pNum}`);
  } else {
    if (jsonMode) console.log(JSON.stringify({ success: false }));
    process.exit(1);
  }
}

module.exports = {
  cmdCreateEpic,
  cmdBlueprint,
  cmdReadTree,
  cmdShip,
  cmdLinkChild
};
