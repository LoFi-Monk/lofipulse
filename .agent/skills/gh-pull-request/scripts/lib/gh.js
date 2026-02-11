/**
 * Low-level wrappers around the `gh` CLI and GitHub GraphQL API.
 *
 * Provides isolation for GitHub interactions.
 * Uses PowerShell shell on Windows to ensure consistent quoting behavior.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Wraps a value in PowerShell single-quotes, escaping embedded quotes.
 *
 * Guarantees the value will be treated as a single literal token by
 * PowerShell, regardless of special characters or spaces.
 */
function quotePS(val) {
  if (val === null || val === undefined) return "''";
  const str = String(val);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Executes a GraphQL query/mutation via `gh api graphql`.
 *
 * Handles temp file creation for large queries and variable passing via flags.
 *
 * @returns Parsed JSON response, or null on any error.
 */
function runGraphQL(query, variables = {}) {
  const tmpFile = path.join(os.tmpdir(), `gh-query-${Date.now()}.graphql`);

  try {
    fs.writeFileSync(tmpFile, query, 'utf-8');

    let cmd = `gh api graphql -F query=@"${tmpFile}"`;

    for (const [k, v] of Object.entries(variables)) {
      if (typeof v === 'number' || typeof v === 'boolean') {
        cmd += ` -F ${k}=${v}`;
      } else if (typeof v === 'object') {
        const json = JSON.stringify(v);
        cmd += ` -F ${k}=${quotePS(json)}`;
      } else {
        cmd += ` -f ${k}=${quotePS(v)}`;
      }
    }

    const raw = execSync(cmd, {
      encoding: 'utf-8',
      shell: 'powershell.exe',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const data = JSON.parse(raw);
    if (data.errors) {
      console.error('GraphQL Error:', JSON.stringify(data.errors, null, 2));
      return null;
    }
    return data;
  } catch (err) {
    console.error('Error executing GraphQL:', err.stderr || err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Runs an arbitrary `gh` CLI command and returns trimmed stdout.
 *
 * @returns Output string on success, or null on failure.
 */
function gh(args) {
  try {
    const cmd = `gh ${args}`;
    return execSync(cmd, {
      encoding: 'utf-8',
      shell: 'powershell.exe',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    // console.error(`Command failed: gh ${args}`, err.stderr); // Optional debug
    return null;
  }
}

module.exports = { quotePS, runGraphQL, gh };
