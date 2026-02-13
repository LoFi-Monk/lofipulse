const fs = require('fs');
const path = require('path');

/**
 * High-level PR review commands.
 *
 * Each function corresponds to a CLI command (--list, --resolve-all,
 * --review-all, --apply). They compose the thread primitives from
 * threads.js into user-facing workflows.
 */
const {
  getThreads,
  resolveThread,
  replyThread,
  categorizeComment,
  getThreadContext,
  applySuggestion,
} = require('./threads');

/**
 * Provides a summarized or machine-readable list of pull request review threads.
 * 
 * Guarantees a consistent JSON schema when jsonMode is enabled, including 
 * code snippets and categorization, allowing agents to ingest the entire 
 * review state in a single pass.
 */
function cmdList(prNumber, showAll, jsonMode = false) {
  const threads = getThreads(prNumber);
  const jsonList = [];

  if (!jsonMode) console.log(`Review Threads for PR #${prNumber}:`);
  let count = 0;

  for (const t of threads) {
    if (!showAll && t.isResolved) continue;

    const firstComment = t.comments.nodes[0] || null;
    const author = firstComment?.author?.login || 'Unknown';
    const rawBody = firstComment?.body || '';
    let body = rawBody.replace(/\n/g, ' ');
    const category = categorizeComment(rawBody);

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
    const hasSuggestion = rawBody.includes('```suggestion');
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
    console.log(`Status: ${status}`);
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
 * 
 * Guarantees that resolution always happens last to ensure preceding 
 * replies or suggestion applications are processed before the thread is closed.
 * 
 * Callers should pass a valid JSON array of action objects.
 */
function cmdBatchAction(input, prNumber, jsonMode = false) {
  let actions;
  let jsonString = input;

  // If input is a path to a JSON file, read it
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
    if (jsonMode) {
      console.log(JSON.stringify({ success: false, error: 'Invalid batch JSON' }));
    } else {
      console.error('Error: Invalid batch JSON.');
    }
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

    // 1. Apply Suggestion
    if (action.applySuggestion) {
      try {
        applySuggestion(t);
        actionResults.push('Applied suggestion');
      } catch (e) {
        actionResults.push(`Error applying suggestion: ${e.message}`);
        isItemSuccess = false;
      }
    }

    // 2. Reply
    if (action.reply) {
      try {
        replyThread(t.id, action.reply);
        actionResults.push('Posted reply');
      } catch (e) {
        actionResults.push(`Error posting reply: ${e.message}`);
        isItemSuccess = false;
      }
    }

    // 3. Resolve (Must be last)
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

  const overallSuccess = results.every(r => r.success);

  if (jsonMode) {
    console.log(JSON.stringify({ success: overallSuccess, results }));
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
 * Looks up the thread by ID and delegates to applySuggestion().
 */
function cmdApply(prNumber, threadId) {
  const threads = getThreads(prNumber);
  const target = threads.find(t => t.id === threadId);
  if (!target) { console.error(`Thread ${threadId} not found.`); process.exit(1); }
  applySuggestion(target);
}

/**
 * Batch-reviews all unresolved threads using Devin's metadata.
 *
 * This is the primary review workflow. It:
 *   1. Categorizes each thread as BUG, SUGGESTION, or ANALYSIS
 *   2. Auto-resolves ANALYSIS threads (confirmations that don't need action)
 *   3. Reports remaining BUGs and SUGGESTIONs for manual review
 */
function cmdReviewAll(prNumber) {
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

    const category = categorizeComment(firstComment.body);
    const entry = {
      id: t.id,
      path: t.path,
      line: t.line || t.originalLine,
      author: firstComment.author?.login || 'Unknown',
      body: firstComment.body.replace(/\n/g, ' ').slice(0, 150),
      category,
    };

    if (category === 'BUG') bugs.push(entry);
    else if (category === 'SUGGESTION') suggestions.push(entry);
    else analyses.push(entry);
  }

  if (analyses.length > 0) {
    console.log(`Auto-resolving ${analyses.length} analysis/confirmation threads...`);
    for (const a of analyses) resolveThread(a.id);
  }

  if (bugs.length > 0) {
    console.log(`\nBUGS (${bugs.length}) — Must fix:`);
    for (const b of bugs) {
      console.log(`  ID: ${b.id}`);
      console.log(`  File: ${b.path} : ${b.line}`);
      console.log(`  Content: ${b.body}`);
      console.log('');
    }
  }

  if (suggestions.length > 0) {
    console.log(`\nSUGGESTIONS (${suggestions.length}) — Can auto-apply with --apply:`);
    for (const s of suggestions) {
      console.log(`  ID: ${s.id}`);
      console.log(`  File: ${s.path} : ${s.line}`);
      console.log(`  Content: ${s.body}`);
      console.log('');
    }
  }

  if (bugs.length === 0 && suggestions.length === 0) {
    console.log('\nAll threads were analysis/confirmations. Nothing actionable.');
  }

  console.log(`\nSummary: ${bugs.length} bugs, ${suggestions.length} suggestions, ${analyses.length} auto-resolved`);
}

module.exports = { 
  cmdList, 
  cmdResolveAll, 
  cmdApply, 
  cmdReviewAll, 
  cmdReadThread, 
  cmdBatchAction, 
  resolveThread, 
  replyThread 
};
