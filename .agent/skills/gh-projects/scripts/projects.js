#!/usr/bin/env node
/**
 * GitHub Projects V2 — CLI Entry Point
 *
 * Thin CLI wrapper. All logic lives in lib/.
 */
const { getProjectMetadata } = require('./lib/discovery');
const { cmdPulse, cmdAdd, cmdSet, cmdGroom, cmdLinkChild, cmdList } = require('./lib/commands');

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--pulse') { opts.pulse = true; continue; }
    if (arg === '--list') { opts.list = true; continue; }
    if (arg === '--set') { opts.set = true; continue; }
    if (arg === '--groom') { opts.groom = true; continue; }
    if (arg === '--link-child') { opts.linkChild = true; continue; }

    // Flags with values
    if (i + 1 < args.length) {
      if (arg === '--add') { opts.add = parseInt(args[++i], 10); continue; }
      if (arg === '--issue') { opts.issue = parseInt(args[++i], 10); continue; }
      if (arg === '--field') { opts.field = args[++i]; continue; }
      if (arg === '--value') { opts.value = args[++i]; continue; }
      if (arg === '--parent') { opts.parent = parseInt(args[++i], 10); continue; }
      if (arg === '--child') { opts.child = parseInt(args[++i], 10); continue; }
      if (arg === '--owner') { opts.owner = args[++i]; continue; }
      if (arg === '--project') { opts.project = parseInt(args[++i], 10); continue; }
      // Groom sub-flags
      if (arg === '--priority') { opts.priority = args[++i]; continue; }
      if (arg === '--size') { opts.size = args[++i]; continue; }
      if (arg === '--agent') { opts.agent = args[++i]; continue; }
      if (arg === '--label') { opts.label = args[++i]; continue; }
      if (arg === '--status') { opts.status = args[++i]; continue; }
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Usage: node projects.js <command> [options]

Commands:
  --pulse                          Show board status
  --add <issue>                    Add issue to project
  --groom --issue <n> [--priority P1] [--size L] [--agent "Lead Developer"] [--label chore] [--status "In progress"]
                                   Set all mandatory metadata in one shot
  --set --issue <n> --field <f> --value <v>   Update a single board field
  --link-child --parent <n> --child <n>       Link child issue to parent
  --list                           List projects for owner

Options:
  --owner <owner>       Override auto-discovered owner
  --project <number>    Override auto-discovered project number
  -h, --help            Show this help
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const opts = parseArgs();

  if (opts.help || Object.keys(opts).length === 0) {
    printHelp();
    process.exit(0);
  }

  const meta = getProjectMetadata();

  if (opts.owner) meta.owner = opts.owner;
  if (opts.project) meta.projectNumber = opts.project;

  if (opts.pulse) {
    cmdPulse(meta);
  } else if (opts.add) {
    cmdAdd(meta, opts.add);
  } else if (opts.groom) {
    if (!opts.issue) {
      console.error('Error: --groom requires --issue.');
      process.exit(1);
    }
    cmdGroom(meta, opts.issue, {
      priority: opts.priority,
      size: opts.size,
      agent: opts.agent,
      label: opts.label,
      status: opts.status,
    });
  } else if (opts.set) {
    if (!opts.issue || !opts.field || !opts.value) {
      console.error('Error: --set requires --issue, --field, and --value.');
      process.exit(1);
    }
    cmdSet(meta, opts.issue, opts.field, opts.value);
  } else if (opts.linkChild) {
    if (!opts.parent || !opts.child) {
      console.error('Error: --link-child requires --parent and --child.');
      process.exit(1);
    }
    cmdLinkChild(meta, opts.parent, opts.child);
  } else if (opts.list) {
    cmdList(opts.owner || meta.owner);
  } else {
    printHelp();
  }
}

main();
