/**
 * Low-level wrappers around the `gh` CLI and the GitHub GraphQL API.
 *
 * Every GitHub interaction in this skill routes through these two functions.
 * This isolation lets us swap transports (e.g. from CLI to REST) without
 * touching any command logic.
 *
 * Shell strategy: We force `powershell.exe` as the shell on Windows because
 * cmd.exe cannot reliably pass JSON-containing arguments to `gh`. PowerShell
 * single-quoting via quotePS() handles this safely.
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
 * The query is written to a temp file to avoid shell escaping issues with
 * large multi-line strings. Variables are passed as individual CLI flags.
 *
 * Complex input types (e.g. ProjectV2PropertyValue) CANNOT be passed as
 * variables through `gh` CLI — they must be inlined into the query string.
 * See `buildValueGraphQL()` in commands.js for that pattern.
 *
 * @returns Parsed JSON response, or null on any error.
 */
function runGraphQL(query, variables = {}) {
  const tmpFile = path.join(os.tmpdir(), `gh-query-${Date.now()}.graphql`);

  try {
    fs.writeFileSync(tmpFile, query, 'utf-8');

    // Start with the query file reference
    let cmd = `gh api graphql -F query=@"${tmpFile}"`;

    // Append each variable as a CLI flag
    // -F for numbers/bools (gh parses them as non-string), -f for strings
    for (const [k, v] of Object.entries(variables)) {
      if (typeof v === 'number' || typeof v === 'boolean') {
        cmd += ` -F ${k}=${v}`;
      } else if (typeof v === 'object') {
        // JSON objects need PowerShell quoting to survive shell parsing
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
    // Always clean up the temp file, even on error
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

/**
 * Runs an arbitrary `gh` CLI command and returns trimmed stdout.
 *
 * Returns null on any failure (non-zero exit, stderr), allowing callers
 * to use `if (!result)` as a simple error check.
 */
function gh(args) {
  try {
    const cmd = `gh ${args}`;
    return execSync(cmd, {
      encoding: 'utf-8',
      shell: 'powershell.exe',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

module.exports = { quotePS, runGraphQL, gh };
