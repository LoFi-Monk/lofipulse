#!/usr/bin/env node
/**
 * GH PR Conversation Resolver — CLI Entry Point
 *
 * Thin CLI wrapper. All logic lives in lib/.
 * Zero npm dependencies. Auth handled by `gh` CLI.
 */
const { getCurrentPR } = require('./lib/gh');
const { cmdList, cmdResolveAll, cmdReviewAll, cmdApply, resolveThread, replyThread, cmdReadThread, cmdBatchAction } = require('./lib/commands');

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
    if (arg === '--json') { opts.json = true; continue; }

    // Flags with a value
    if (i + 1 < args.length) {
      if (arg === '--pr') { opts.pr = parseInt(args[++i], 10); continue; }
      if (arg === '--resolve') { opts.resolve = args[++i]; continue; }
      if (arg === '--reply') { opts.reply = args[++i]; continue; }
      if (arg === '--thread') { opts.thread = args[++i]; continue; }
      if (arg === '--apply') { opts.apply = args[++i]; continue; }
      if (arg === '--read-thread') { opts.readThread = args[++i]; continue; }
      if (arg === '--batch') { opts.batch = args[++i]; continue; }
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
  --json             Output clean JSON (agent-first)
  --read-thread ID   Fetch full context for a thread
  --batch JSON       Execute multiple actions atomically
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

  // Auto-detect PR from current branch if not specified
  const prNumber = opts.pr || getCurrentPR();
  if (!prNumber) {
    if (opts.json) {
      console.log(JSON.stringify({ success: false, error: 'Could not determine PR number' }));
    } else {
      console.error('Could not determine PR number. Run inside a PR branch or specify --pr.');
    }
    process.exit(1);
  }

  if (opts.list) {
    cmdList(prNumber, opts.all, opts.json);
  } else if (opts.readThread) {
    cmdReadThread(prNumber, opts.readThread, opts.json);
  } else if (opts.batch) {
    cmdBatchAction(opts.batch, prNumber, opts.json);
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
      if (opts.json) {
        console.log(JSON.stringify({ success: false, error: '--thread ID required for reply' }));
      } else {
        console.error('Error: --thread ID required for reply.');
      }
      process.exit(1);
    }
    replyThread(opts.thread, opts.reply);
  } else {
    printHelp();
  }
}

main();
