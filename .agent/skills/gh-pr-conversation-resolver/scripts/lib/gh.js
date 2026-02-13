/**
 * Low-level wrappers around the `gh` CLI and GitHub GraphQL API.
 *
 * Provides the same interface as the gh-projects skill helper, but
 * without PowerShell shell dependency — PR resolver queries are simpler
 * and don't need complex variable passing.
 */
const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Executes a GraphQL query/mutation via `gh api graphql`.
 *
 * Uses spawnSync with stdin piping to completely bypass shell escaping
 * issues on Windows and other platforms.
 *
 * @returns Parsed JSON response, or null on any error.
 */
function runGraphQL(query) {
  const result = spawnSync('gh', ['api', 'graphql', '-F', 'query=@-'], {
    input: query,
    encoding: 'utf-8',
    shell: false
  });

  if (result.status !== 0) {
    console.error('gh api graphql failed with exit code', result.status);
    if (result.stderr) console.error(result.stderr);
    return null;
  }

  try {
    const data = JSON.parse(result.stdout);
    if (data.errors) {
      console.error('GraphQL Error:', JSON.stringify(data.errors, null, 2));
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error parsing GraphQL response:', err.message);
    return null;
  }
}

/** Returns { owner: { login }, name } for the current repo, or null. */
function getRepoInfo() {
  try {
    const raw = execSync('gh repo view --json owner,name', { encoding: 'utf-8' });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Auto-detects the current PR number from the checked-out branch.
 * Returns null if not on a PR branch.
 */
function getCurrentPR() {
  try {
    const raw = execSync('gh pr view --json number', { encoding: 'utf-8' });
    return JSON.parse(raw).number;
  } catch {
    return null;
  }
}

module.exports = { runGraphQL, getRepoInfo, getCurrentPR };
