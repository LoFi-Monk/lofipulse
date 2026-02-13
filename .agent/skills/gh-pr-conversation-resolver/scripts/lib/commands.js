/**
 * High-level PR review commands.
 *
 * Each function corresponds to a CLI command (--list, --resolve-all,
 * --review-all, --apply). They compose the thread primitives from
 * threads.js into user-facing workflows.
 */
const fs = require('fs');
const path = require('path');
const {
  getThreads,
  resolveThread,
  replyThread,
  categorizeComment,
  getThreadContext,
  applySuggestion,
} = require('./threads');

// TEMP_DIR is the default location for cmdPlan artifacts.
// Note: cmdApplyPlan remains path-agnostic and accepts any JSON path.
const TEMP_DIR = path.resolve(process.cwd(), 'review_temp');

/**
 * Lists review threads with status, location, and content preview.
 * Supports filtering by author and category, and optional JSON output.
 *
 * @param {Number} prNumber
 * @param {Boolean} showAll - Include resolved threads.
 * @param {String} authorFilter - Filter by author login.
 * @param {String} categoryFilter - Filter by BUG|SUGGESTION|ANALYSIS.
 * @param {Boolean} jsonMode - Output as machine-readable JSON.
 */
function cmdList(prNumber, showAll = false, authorFilter = null, categoryFilter = null, jsonMode = false) {
  const threads = getThreads(prNumber);
  const jsonList = [];

  if (!jsonMode) console.log(`Review Threads for PR #${prNumber}:`);
  let count = 0;

  for (const t of threads) {
    if (!showAll && t.isResolved) continue;

    const firstComment = t.comments.nodes[0] || null;
    const author = firstComment?.author?.login || 'Unknown';
    const rawBody = firstComment?.body || '';
    const category = firstComment ? categorizeComment(rawBody) : 'UNKNOWN';

    // Apply filters
    if (authorFilter && author.toLowerCase() !== authorFilter.toLowerCase()) continue;
    if (categoryFilter && category.toUpperCase() !== categoryFilter.toUpperCase()) continue;

    if (jsonMode) {
      jsonList.push({
        id: t.id,
        isResolved: t.isResolved,
        path: t.path,
        line: t.line || t.originalLine,
        author,
        category,
        body: rawBody,
        code_snippet: getThreadContext(t),
      });
      continue;
    }

    const status = t.isResolved ? 'Resolved' : 'Unresolved';
    let body = rawBody.replace(/\n/g, ' ');

    const hasSuggestion = body.includes('```suggestion');
    const icon = hasSuggestion ? '[SUGGESTION]' : '';

    if (body.length > 100) body = body.slice(0, 97) + '...';

    // Threads can become "outdated" when the code they reference changes
    let location = t.line;
    let flag = '';
    if (location == null) {
      location = t.originalLine;
      flag = ' (Outdated)';
    }

    console.log(`\nID: ${t.id} ${icon}`);
    console.log(`Status: ${status} | Category: ${category}`);
    console.log(`File: ${t.path} : ${location}${flag}`);
    console.log(`Author: ${author}`);
    console.log(`Content: ${body}`);
    count++;
  }

  if (jsonMode) {
    console.log(JSON.stringify({ success: true, threads: jsonList }));
    return;
  }

  if (count === 0) console.log('No threads found matching criteria.');
}

/**
 * Retrieves detailed information and full source context for a specific review thread.
 * 
 * Guarantees the inclusion of the latest comment and surrounding code block 
 * for the target thread, enabling deep analysis of a single feedback point.
 */
function cmdReadThread(prNumber, threadId, jsonMode = false) {
  const threads = getThreads(prNumber);
  const t = threads.find(thread => thread.id === threadId);

  if (!t) {
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: `Thread ${threadId} not found` }));
    } else {
      console.error(`Error: Thread ${threadId} not found.`);
    }
    process.exit(1);
  }

  const firstComment = t.comments.nodes[0] || null;
  const author = firstComment?.author?.login || 'Unknown';
  const rawBody = firstComment?.body || '';
  const category = categorizeComment(rawBody);

  if (jsonMode) {
    console.log(JSON.stringify({
      success: true,
      thread: {
        id: t.id,
        isResolved: t.isResolved,
        path: t.path,
        line: t.line || t.originalLine,
        author,
        category,
        body: rawBody,
        code_snippet: getThreadContext(t),
        comments: t.comments.nodes,
      }
    }));
  } else {
    console.log(`\n--- Thread: ${t.id} ---`);
    console.log(`File: ${t.path} : ${t.line || t.originalLine}`);
    console.log(`Category: ${category}`);
    console.log(`\nCode Context:\n${getThreadContext(t)}`);
    console.log(`\nLatest Comment (${author}):\n${rawBody}\n`);
  }
}

/**
 * Executes a sequence of operations (Apply, Reply, Resolve) across multiple 
 * review threads in a single atomic cycle.
 */
function cmdBatchAction(input, prNumber, jsonMode = false) {
  let actions;
  let jsonString = input;

  if (input.endsWith('.json') && fs.existsSync(path.resolve(process.cwd(), input))) {
    try {
      jsonString = fs.readFileSync(path.resolve(process.cwd(), input), 'utf8');
    } catch (e) {
      if (jsonMode) console.log(JSON.stringify({ success: false, error: `Failed to read batch file: ${input}` }));
      else console.error(`Error: Failed to read batch file: ${input}`);
      process.exit(1);
    }
  }

  try {
    actions = JSON.parse(jsonString);
  } catch (e) {
    if (jsonMode) console.log(JSON.stringify({ success: false, error: 'Invalid batch JSON' }));
    else console.error('Error: Invalid batch JSON.');
    process.exit(1);
  }

  const threads = getThreads(prNumber);
  const results = [];

  for (const action of actions) {
    const t = threads.find(thread => thread.id === action.id);
    if (!t) {
      results.push({ id: action.id, success: false, error: 'Thread not found' });
      continue;
    }

    const actionResults = [];
    let isItemSuccess = true;

    if (action.applySuggestion) {
      try {
        applySuggestion(t);
        actionResults.push('Applied suggestion');
      } catch (e) {
        actionResults.push(`Error applying suggestion: ${e.message}`);
        isItemSuccess = false;
      }
    }

    if (action.reply) {
      try {
        replyThread(t.id, action.reply);
        actionResults.push('Posted reply');
      } catch (e) {
        actionResults.push(`Error posting reply: ${e.message}`);
        isItemSuccess = false;
      }
    }

    if (action.resolve) {
      try {
        resolveThread(t.id);
        actionResults.push('Resolved thread');
      } catch (e) {
        actionResults.push(`Error resolving thread: ${e.message}`);
        isItemSuccess = false;
      }
    }

    const hasErrors = !isItemSuccess || actionResults.some(a => a.startsWith('Error'));
    results.push({ id: action.id, success: !hasErrors, actions: actionResults });
  }

  if (jsonMode) {
    console.log(JSON.stringify({ success: results.every(r => r.success), results }));
  } else {
    console.log('\n--- Batch Action Results ---');
    results.forEach(r => {
      console.log(`Thread ${r.id}: ${r.success ? 'Success' : 'Failed'}`);
      if (r.actions) r.actions.forEach(a => console.log(`  + ${a}`));
      if (r.error) console.log(`  ! ${r.error}`);
    });
  }
}

/** Resolves every unresolved thread on the PR in one pass. */
function cmdResolveAll(prNumber) {
  const threads = getThreads(prNumber);
  const unresolved = threads.filter(t => !t.isResolved);
  if (unresolved.length === 0) {
    console.log(`No unresolved threads found for PR #${prNumber}.`);
    return;
  }
  console.log(`Resolving ${unresolved.length} threads...`);
  for (const t of unresolved) resolveThread(t.id);
}

/**
 * Applies a code suggestion from a thread directly to the local file.
 */
function cmdApply(prNumber, threadId) {
  const threads = getThreads(prNumber);
  const target = threads.find(t => t.id === threadId);
  if (!target) { console.error(`Thread ${threadId} not found.`); process.exit(1); }
  applySuggestion(target);
}

/**
 * Batch-reviews threads using Devin's metadata and user-specified filters.
 */
function cmdReviewAll(prNumber, authorFilter = null, categoryFilter = null) {
  const threads = getThreads(prNumber);
  const unresolved = threads.filter(t => !t.isResolved);

  if (unresolved.length === 0) {
    console.log(`No unresolved threads found for PR #${prNumber}.`);
    return;
  }

  console.log(`\nReviewing ${unresolved.length} unresolved threads for PR #${prNumber}...\n`);

  const bugs = [];
  const suggestions = [];
  const analyses = [];

  for (const t of unresolved) {
    const firstComment = t.comments.nodes[0];
    if (!firstComment) continue;

    const author = firstComment.author?.login || 'Unknown';
    const category = categorizeComment(firstComment.body);

    if (authorFilter && author.toLowerCase() !== authorFilter.toLowerCase()) continue;
    if (categoryFilter && category.toUpperCase() !== categoryFilter.toUpperCase()) continue;

    const entry = {
      id: t.id,
      path: t.path,
      line: t.line || t.originalLine,
      author,
      body: firstComment.body.replace(/\n/g, ' ').slice(0, 150),
      category,
    };

    if (category === 'BUG') bugs.push(entry);
    else if (category === 'SUGGESTION') suggestions.push(entry);
    else analyses.push(entry);
  }

  // Auto-resolve ANALYSIS threads
  if (analyses.length > 0) {
    console.log(`Auto-resolving ${analyses.length} analysis/confirmation threads...`);
    for (const a of analyses) resolveThread(a.id);
  }

  // Report actionable items
  if (bugs.length > 0) {
    console.log(`\nBUGS (${bugs.length}) — Must fix:`);
    for (const b of bugs) {
      console.log(`  ID: ${b.id} | File: ${b.path} : ${b.line}`);
      console.log(`  Content: ${b.body}\n`);
    }
  }

  if (suggestions.length > 0) {
    console.log(`\nSUGGESTIONS (${suggestions.length}) — Can apply with --apply:`);
    for (const s of suggestions) {
      console.log(`  ID: ${s.id} | File: ${s.path} : ${s.line}`);
      console.log(`  Content: ${s.body}\n`);
    }
  }

  console.log(`Summary: ${bugs.length} bugs, ${suggestions.length} suggestions, ${analyses.length} auto-resolved`);
}

/**
 * Generates a "Resolution Plan" JSON artifact for offline/batch management.
 */
function cmdPlan(prNumber) {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

  const threads = getThreads(prNumber);
  const plan = threads.map(t => {
    const firstComment = t.comments.nodes[0];
    return {
      id: t.id,
      status: t.isResolved ? 'resolved' : 'unresolved',
      path: t.path,
      line: t.line || t.originalLine,
      author: firstComment?.author?.login || 'Unknown',
      category: firstComment ? categorizeComment(firstComment.body) : 'UNKNOWN',
      body: firstComment?.body || '',
      proposed_action: null // User/Agent should fill this with 'resolve' or 'reply-and-resolve'
    };
  });

  const planPath = path.join(TEMP_DIR, 'resolution_plan.json');
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
  console.log(`Resolution plan exported to: ${planPath}`);
  console.log('Update the "proposed_action" field in the JSON, then run with --apply-plan.');
}

/**
 * Processes a "Resolution Plan" JSON file.
 *
 * @param {String} planPath
 * @param {Boolean} dryRun - If true, logs actions without executing mutations.
 */
function cmdApplyPlan(planPath, dryRun = false) {
  if (!fs.existsSync(planPath)) {
    console.error(`Error: Plan file not found at ${planPath}`);
    process.exit(1);
  }

  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const actions = plan.filter(item => item.proposed_action != null);

  if (actions.length === 0) {
    console.log('No proposed actions found in plan.');
    return;
  }

  console.log(`${dryRun ? '[DRY RUN] ' : ''}Executing ${actions.length} actions from plan...`);

  for (const item of actions) {
    const action = item.proposed_action.toLowerCase();
    
    if (action === 'resolve') {
      console.log(`- Resolve ${item.id}`);
      if (!dryRun) resolveThread(item.id);
    } else if (action === 'reply-and-resolve') {
      const replyBody = item.reply_body || 'Acknowledged and resolved.';
      console.log(`- Reply & Resolve ${item.id}: "${replyBody}"`);
      if (!dryRun) {
        replyThread(item.id, replyBody);
        resolveThread(item.id);
      }
    } else {
      console.warn(`Unknown action '${item.proposed_action}' for thread ${item.id}`);
    }
  }
}

/**
 * Archives the review_temp directory rather than deleting it.
 */
function cmdCleanup() {
  if (!fs.existsSync(TEMP_DIR)) {
    console.log('Nothing to cleanup.');
    return;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archivePath = path.resolve(process.cwd(), `review_temp_archive_${timestamp}`);
  fs.renameSync(TEMP_DIR, archivePath);
  console.log(`Review temp directory archived to: ${archivePath}`);
}

module.exports = {
  cmdList,
  cmdReadThread,
  cmdBatchAction,
  cmdResolveAll,
  cmdApply,
  cmdReviewAll,
  cmdPlan,
  cmdApplyPlan,
  cmdCleanup,
  resolveThread,
  replyThread
};
