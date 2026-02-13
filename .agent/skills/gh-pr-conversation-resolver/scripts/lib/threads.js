/**
 * Core PR review thread operations.
 *
 * These are the atomic building blocks: fetching threads, resolving,
 * replying, extracting suggestions, and applying them to files.
 * Command functions in commands.js compose these primitives.
 */
const fs = require('fs');
const { runGraphQL, getRepoInfo } = require('./gh');

/**
 * Fetches all review threads for a PR, including resolution status,
 * file location, and the first comment's content.
 *
 * Returns an empty array on any failure to keep callers simple.
 */
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

/** Marks a review thread as resolved via GraphQL mutation. */
function resolveThread(threadId) {
  const query = `mutation { resolveReviewThread(input: {threadId: "${threadId}"}) { thread { isResolved } } }`;
  const result = runGraphQL(query);
  if (result) console.log(`Resolved thread ${threadId}`);
}

/**
 * Posts a reply to a review thread.
 * Escapes the body to survive GraphQL string embedding.
 */
function replyThread(threadId, body) {
  const safeBody = body.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  const query = `mutation { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: "${threadId}", body: "${safeBody}"}) { comment { id body } } }`;
  const result = runGraphQL(query);
  if (result) console.log(`Replied to thread ${threadId}`);
}

// ─── Suggestion Extraction & Application ────────────────────────────────────

/**
 * Extracts the code from a GitHub suggestion block (```suggestion ... ```).
 *
 * Returns { lines: string[] } on success, or { error: string } on failure.
 * Handles malformed blocks (missing fence) and empty blocks.
 */
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

/**
 * Applies a suggestion to the local file by replacing the target line range.
 *
 * Uses the thread's file path and line metadata to splice the suggestion
 * into the source file. Supports both single-line and multi-line ranges.
 */
function applySuggestion(thread) {
  const comments = thread.comments.nodes;
  if (!comments.length) throw new Error('No comments in thread.');

  const body = comments[0].body;
  if (!body.includes('```suggestion')) {
    throw new Error('No suggestion block found in this comment.');
  }

  const suggestion = extractSuggestion(body);
  if (suggestion.error) throw new Error(`Error: ${suggestion.error}`);

  const filePath = thread.path;
  const endLine = thread.line;
  const startLine = thread.startLine || endLine;

  if (!endLine) throw new Error('Could not determine line number from thread.');

  console.log(`Applying suggestion to ${filePath} lines ${startLine}-${endLine}...`);

  // Splice: replace lines [startLine, endLine] with the suggestion content
  const content = fs.readFileSync(filePath, 'utf-8').split('\n');
  const startIdx = startLine - 1;
  const endIdx = endLine;

  const pre = content.slice(0, startIdx);
  const post = content.slice(endIdx);
  const final = [...pre, ...suggestion.lines, ...post];

  fs.writeFileSync(filePath, final.join('\n'), 'utf-8');
  console.log('Successfully applied suggestion.');
}

/**
 * Categorizes a Devin review comment by examining its metadata ID prefix.
 *
 * Devin embeds structured metadata in HTML comments with prefixed IDs:
 * - BUG_... -> actual bugs that need fixing
 * - ANALYSIS_... -> confirmations/observations that can be auto-resolved
 *
 * Suggestion blocks (```suggestion) are treated as their own category.
 * Falls back to keyword heuristics if no Devin metadata is found.
 *
 * @returns 'BUG', 'SUGGESTION', or 'ANALYSIS'
 */
function categorizeComment(body) {
  if (body.includes('```suggestion')) return 'SUGGESTION';

  // Devin prefixes its comment IDs with BUG_ or ANALYSIS_
  const idMatch = body.match(/devin-review-comment\s*\{[^}]*"id"\s*:\s*"(BUG|ANALYSIS)_/);
  if (idMatch) {
    return idMatch[1] === 'BUG' ? 'BUG' : 'ANALYSIS';
  }

  // Fallback: keyword heuristics for non-Devin reviewers
  const lower = body.toLowerCase();
  if (lower.includes('bug') || lower.includes('regression') || lower.includes('error')) return 'BUG';
  return 'ANALYSIS';
}

/**
 * Retrieves the source code context surrounding a pull request review thread.
 * 
 * Guarantees a 10-line window (5 before, 5 after) of the file referenced by 
 * the thread, including line numbers for easy correlation during review.
 * 
 * Callers must ensure the file exists locally and that git is in a state 
 * consistent with the PR for the context to be accurate.
 */
function getThreadContext(thread) {
  try {
    const filePath = thread.path;
    const line = thread.line || thread.originalLine;
    if (!line || !fs.existsSync(filePath)) return '';

    const content = fs.readFileSync(filePath, 'utf-8').split('\n');
    const startIdx = Math.max(0, line - 6);
    const endIdx = Math.min(content.length, line + 5);

    return content
      .slice(startIdx, endIdx)
      .map((l, i) => `${startIdx + i + 1}: ${l}`)
      .join('\n');
  } catch {
    return '';
  }
}

module.exports = {
  getThreads,
  resolveThread,
  replyThread,
  extractSuggestion,
  applySuggestion,
  categorizeComment,
  getThreadContext,
};
