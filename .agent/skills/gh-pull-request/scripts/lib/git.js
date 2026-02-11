/**
 * Git context helpers.
 *
 * Handles branch detection and parsing issue numbers from branch names.
 */
const { execSync } = require('child_process');

/**
 * Returns the name of the currently checked-out branch.
 */
function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Parses an issue number from a branch name.
 *
 * Supports patterns:
 * - feature/issue-123-description
 * - issue-123
 * - 123-description
 * - fix/123-bug
 *
 * @returns {number|null} The issue number, or null if not found.
 */
function parseIssueFromBranch(branchName) {
  if (!branchName) return null;

  // Pattern checks:
  // 1. "issue-123" anywhere
  const matchIssue = branchName.match(/issue-(\d+)/i);
  if (matchIssue) return parseInt(matchIssue[1], 10);

  // 2. "/123-" or "^123-" (number at start or after slash, followed by hyphen)
  const matchNumHyphen = branchName.match(/(?:^|\/)(\d+)-/);
  if (matchNumHyphen) return parseInt(matchNumHyphen[1], 10);

  // 3. Just a number? (rare but possible)
  if (/^\d+$/.test(branchName)) return parseInt(branchName, 10);

  return null;
}

module.exports = { getCurrentBranch, parseIssueFromBranch };
