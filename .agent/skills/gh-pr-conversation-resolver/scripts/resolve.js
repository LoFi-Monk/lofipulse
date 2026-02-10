#!/usr/bin/env node
/**
 * GH PR Conversation Resolver — Node.js Edition
 *
 * Portable skill script. Zero npm dependencies.
 * Auth handled entirely by `gh` CLI (whatever account is logged in).
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Helpers ────────────────────────────────────────────────────────────────

function runGraphQL(query) {
  const tmpFile = path.join(os.tmpdir(), `gh-query-${Date.now()}.graphql`);
  try {
    fs.writeFileSync(tmpFile, query, 'utf-8');
    const raw = execSync(`gh api graphql -F query=@"${tmpFile}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const data = JSON.parse(raw);
    if (data.errors) {
      console.error('GraphQL Error:', JSON.stringify(data.errors, null, 2));
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error executing GraphQL query:', err.stderr || err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

function getRepoInfo() {
  try {
    const raw = execSync('gh repo view --json owner,name', { encoding: 'utf-8' });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCurrentPR() {
  try {
    const raw = execSync('gh pr view --json number', { encoding: 'utf-8' });
    return JSON.parse(raw).number;
  } catch {
    return null;
  }
}

// ─── Core Functions ─────────────────────────────────────────────────────────

function getThreads(prNumber) {
  const repo = getRepoInfo();
  if (!repo) return [];

  const query = `
    query {
      repository(owner: "${repo.owner.login}", name: "${repo.name}") {
        pullRequest(number: ${prNumber}) {
          reviewThreads(first: 50) {
            nodes {
              id
              isResolved
              path
              line
              startLine
              originalLine
              comments(first: 1) {
                nodes {
                  author { login }
                  body
                  createdAt
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query);
  if (!result) return [];
  try {
    return result.data.repository.pullRequest.reviewThreads.nodes;
  } catch {
    return [];
  }
}

function resolveThread(threadId) {
  const query = `mutation { resolveReviewThread(input: {threadId: "${threadId}"}) { thread { isResolved } } }`;
  const result = runGraphQL(query);
  if (result) console.log(`Resolved thread ${threadId}`);
}

function replyThread(threadId, body) {
  const safeBody = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const query = `mutation { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: "${threadId}", body: "${safeBody}"}) { comment { id body } } }`;
  const result = runGraphQL(query);
  if (result) console.log(`Replied to thread ${threadId}`);
}

// ─── Suggestion Application ─────────────────────────────────────────────────

function extractSuggestion(body) {
  const lines = body.split('\n');
  const suggestionLines = [];
  let inBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```suggestion')) {
      inBlock = true;
      continue;
    }
    if (inBlock && line.trim().startsWith('```')) {
      inBlock = false;
      break;
    }
    if (inBlock) suggestionLines.push(line);
  }

  if (inBlock) return { error: 'Malformed suggestion block (missing closing fence).' };
  if (suggestionLines.length === 0) return { error: 'Empty suggestion block.' };
  return { lines: suggestionLines };
}

function applySuggestion(thread) {
  const comments = thread.comments.nodes;
  if (!comments.length) { console.error('No comments in thread.'); process.exit(1); }

  const body = comments[0].body;
  if (!body.includes('```suggestion')) {
    console.error('No suggestion block found in this comment.');
    process.exit(1);
  }

  const suggestion = extractSuggestion(body);
  if (suggestion.error) { console.error(`Error: ${suggestion.error}`); process.exit(1); }

  const filePath = thread.path;
  const endLine = thread.line;
  const startLine = thread.startLine || endLine;

  if (!endLine) { console.error('Could not determine line number from thread.'); process.exit(1); }

  console.log(`Applying suggestion to ${filePath} lines ${startLine}-${endLine}...`);

  const content = fs.readFileSync(filePath, 'utf-8').split('\n');
  const startIdx = startLine - 1;
  const endIdx = endLine;

  const pre = content.slice(0, startIdx);
  const post = content.slice(endIdx);
  const final = [...pre, ...suggestion.lines, ...post];

  fs.writeFileSync(filePath, final.join('\n'), 'utf-8');
  console.log('Successfully applied suggestion.');
}

// ─── Categorization (for --review-all) ──────────────────────────────────────

/**
 * Categorize a Devin review comment by examining its metadata ID prefix and content.
 *
 * Returns 'BUG', 'SUGGESTION', or 'ANALYSIS'.
 */
function categorizeComment(body) {
  if (body.includes('```suggestion')) return 'SUGGESTION';

  // Devin prefixes its comment IDs with BUG_ or ANALYSIS_
  const idMatch = body.match(/devin-review-comment\s*\{[^}]*"id"\s*:\s*"(BUG|ANALYSIS)_/);
  if (idMatch) {
    return idMatch[1] === 'BUG' ? 'BUG' : 'ANALYSIS';
  }

  // Fallback heuristics
  const lower = body.toLowerCase();
  if (lower.includes('bug') || lower.includes('regression') || lower.includes('error')) return 'BUG';
  return 'ANALYSIS';
}

// ─── Commands ───────────────────────────────────────────────────────────────

function cmdList(prNumber, showAll) {
  const threads = getThreads(prNumber);
  console.log(`Review Threads for PR #${prNumber}:`);
  let count = 0;

  for (const t of threads) {
    if (!showAll && t.isResolved) continue;

    const status = t.isResolved ? '✅ Resolved' : '🔴 Unresolved';
    const firstComment = t.comments.nodes[0] || null;
    const author = firstComment?.author?.login || 'Unknown';
    let body = (firstComment?.body || '').replace(/\n/g, ' ');

    const hasSuggestion = body.includes('```suggestion');
    const icon = hasSuggestion ? '💡' : ' ';

    if (body.length > 100) body = body.slice(0, 97) + '...';

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

function cmdApply(prNumber, threadId) {
  const threads = getThreads(prNumber);
  const target = threads.find(t => t.id === threadId);
  if (!target) { console.error(`Thread ${threadId} not found.`); process.exit(1); }
  applySuggestion(target);
}

function cmdReviewAll(prNumber) {
  const threads = getThreads(prNumber);
  const unresolved = threads.filter(t => !t.isResolved);

  if (unresolved.length === 0) {
    console.log(`No unresolved threads found for PR #${prNumber}.`);
    return;
  }

  console.log(`\n📋 Reviewing ${unresolved.length} unresolved threads for PR #${prNumber}...\n`);

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

  // Auto-resolve ANALYSIS threads (confirmations)
  if (analyses.length > 0) {
    console.log(`✅ Auto-resolving ${analyses.length} analysis/confirmation threads...`);
    for (const a of analyses) resolveThread(a.id);
  }

  // Report actionable items
  if (bugs.length > 0) {
    console.log(`\n🐛 BUGS (${bugs.length}) — Must fix:`);
    for (const b of bugs) {
      console.log(`  ID: ${b.id}`);
      console.log(`  File: ${b.path} : ${b.line}`);
      console.log(`  Content: ${b.body}`);
      console.log('');
    }
  }

  if (suggestions.length > 0) {
    console.log(`\n💡 SUGGESTIONS (${suggestions.length}) — Can auto-apply with --apply:`);
    for (const s of suggestions) {
      console.log(`  ID: ${s.id}`);
      console.log(`  File: ${s.path} : ${s.line}`);
      console.log(`  Content: ${s.body}`);
      console.log('');
    }
  }

  if (bugs.length === 0 && suggestions.length === 0) {
    console.log('\n✅ All threads were analysis/confirmations. Nothing actionable.');
  }

  console.log(`\n📊 Summary: ${bugs.length} bugs, ${suggestions.length} suggestions, ${analyses.length} auto-resolved`);
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--list') { opts.list = true; continue; }
    if (arg === '--all') { opts.all = true; continue; }
    if (arg === '--resolve-all') { opts.resolveAll = true; continue; }
    if (arg === '--review-all') { opts.reviewAll = true; continue; }

    // Flags with a value
    if (i + 1 < args.length) {
      if (arg === '--pr') { opts.pr = parseInt(args[++i], 10); continue; }
      if (arg === '--resolve') { opts.resolve = args[++i]; continue; }
      if (arg === '--reply') { opts.reply = args[++i]; continue; }
      if (arg === '--thread') { opts.thread = args[++i]; continue; }
      if (arg === '--apply') { opts.apply = args[++i]; continue; }
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Usage: node resolve.js [options]

Options:
  --pr NUMBER        Pull Request number (auto-detects if omitted)
  --list             List unresolved threads
  --all              Include resolved threads in list
  --resolve ID       Resolve a specific thread
  --reply TEXT       Reply text (use with --resolve or --thread)
  --thread ID        Thread ID for reply
  --resolve-all      Resolve ALL unresolved threads
  --review-all       Batch review: categorize, auto-resolve analysis, report bugs
  --apply ID         Apply a suggestion block from a thread
  -h, --help         Show this help
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs();

  if (opts.help || Object.keys(opts).length === 0) {
    printHelp();
    process.exit(0);
  }

  const prNumber = opts.pr || getCurrentPR();
  if (!prNumber) {
    console.error('Could not determine PR number. Run inside a PR branch or specify --pr.');
    process.exit(1);
  }

  if (opts.list) {
    cmdList(prNumber, opts.all);
  } else if (opts.resolve) {
    resolveThread(opts.resolve);
    if (opts.reply) replyThread(opts.resolve, opts.reply);
  } else if (opts.resolveAll) {
    cmdResolveAll(prNumber);
  } else if (opts.reviewAll) {
    cmdReviewAll(prNumber);
  } else if (opts.apply) {
    cmdApply(prNumber, opts.apply);
  } else if (opts.reply) {
    if (!opts.thread) {
      console.error('Error: --thread ID required for reply.');
      process.exit(1);
    }
    replyThread(opts.thread, opts.reply);
  } else {
    printHelp();
  }
}

main();
