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
  applySuggestion,
} = require('./threads');

/**
 * Lists review threads with status, location, and content preview.
 * Shows only unresolved threads unless --all is also passed.
 */
function cmdList(prNumber, showAll) {
  const threads = getThreads(prNumber);
  console.log(`Review Threads for PR #${prNumber}:`);
  let count = 0;

  for (const t of threads) {
    if (!showAll && t.isResolved) continue;

    const status = t.isResolved ? 'Resolved' : 'Unresolved';
    const firstComment = t.comments.nodes[0] || null;
    const author = firstComment?.author?.login || 'Unknown';
    let body = (firstComment?.body || '').replace(/\n/g, ' ');

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
    console.log(`Status: ${status}`);
    console.log(`File: ${t.path} : ${location}${flag}`);
    console.log(`Author: ${author}`);
    console.log(`Content: ${body}`);
    count++;
  }

  if (count === 0) console.log('No threads found matching criteria.');
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
 *
 * Designed to reduce a 20+ thread review session down to a handful
 * of genuinely actionable items.
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

  // Auto-resolve ANALYSIS threads (they're just confirmations)
  if (analyses.length > 0) {
    console.log(`Auto-resolving ${analyses.length} analysis/confirmation threads...`);
    for (const a of analyses) resolveThread(a.id);
  }

  // Report actionable items that need human attention
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

module.exports = { cmdList, cmdResolveAll, cmdApply, cmdReviewAll, resolveThread, replyThread };
