/**
 * Low-level wrappers around the `gh` CLI and GitHub GraphQL API.
 *
 * Provides the same interface as the gh-projects skill helper, but
 * without PowerShell shell dependency — PR resolver queries are simpler
 * and don't need complex variable passing.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Executes a GraphQL query/mutation via `gh api graphql`.
 *
 * The query is written to a temp file to avoid shell escaping issues.
 * Unlike the gh-projects helper, this version doesn't need variable
 * support — all values are inlined into the query string because PR
 * review mutations only use simple string IDs.
 *
 * @returns Parsed JSON response, or null on any error.
 */
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
