#!/usr/bin/env node
/**
 * GH Pull Request Skill — CLI Entry Point
 *
 * Automates PR creation with metadata inheritance.
 */
const { cmdCreate } = require('./lib/commands');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--create') { opts.create = true; continue; }
    if (arg === '--dry-run') { opts.dryRun = true; continue; }

    if (i + 1 < args.length) {
      if (arg === '--issue') { opts.issue = parseInt(args[++i], 10); continue; }
      if (arg === '--title') { opts.title = args[++i]; continue; }
      if (arg === '--label') { opts.label = args[++i]; continue; }
      if (arg === '--body') { opts.body = args[++i]; continue; }
      if (arg === '--body-file') { opts.bodyFile = args[++i]; continue; }
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Usage: node gh-pr.js [options]

Commands:
  --create           Create a PR for the current branch

Options:
  --issue <N>        Manually specify the linked issue number (overrides branch parsing)
  --title "..."      PR title (defaults to issue title)
  --label "..."      Add a specific label (in addition to inherited ones)
  --body "..."       PR description base text (inline)
  --body-file <path> Read PR body from a markdown file (overrides --body and template)
  --dry-run          Preview what would happen without creating the PR
  -h, --help         Show this help

Metadata Inheritance:
  - Links to issue derived from branch name (e.g. 'feat/issue-21')
  - Inherits labels from the linked issue
  - Adds PR to the same Project Board as the linked issue
  - Appends "Closes #N" to the PR body
`);
}

function main() {
  const opts = parseArgs();

  // Clean args of undefined
  for (const k in opts) { if (opts[k] === undefined) delete opts[k]; }

  if (opts.help || Object.keys(opts).length === 0) {
    printHelp();
    process.exit(0);
  }

  if (opts.create || opts.dryRun) {
    cmdCreate(opts);
  } else {
    printHelp();
  }
}

main();
