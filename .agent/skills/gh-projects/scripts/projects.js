#!/usr/bin/env node
/**
 * GitHub Projects V2 — CLI Entry Point
 *
 * Thin CLI wrapper. All logic lives in lib/.
 */
const { getProjectMetadata } = require('./lib/discovery');
const { cmdPulse, cmdAdd, cmdSet, cmdGroom, cmdLinkChild, cmdList, cmdCreateEpic, cmdBlueprint, cmdReadTree, cmdShip } = require('./lib/commands');

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
    if (arg === '--json') { opts.json = true; continue; }
    if (arg === '--ship') { opts.ship = true; continue; }

    // Flags with values
    if (i + 1 < args.length) {
      if (arg === '--add') { opts.add = parseInt(args[++i], 10); continue; }
      if (arg === '--create-epic') { opts.createEpic = args[++i]; continue; }
      if (arg === '--read-tree') { opts.readTree = parseInt(args[++i], 10); continue; }
      if (arg === '--issue') { opts.issue = parseInt(args[++i], 10); continue; }
      if (arg === '--field') { opts.field = args[++i]; continue; }
      if (arg === '--value') { opts.value = args[++i]; continue; }
      if (arg === '--parent') { opts.parent = parseInt(args[++i], 10); continue; }
      if (arg === '--child') { opts.child = parseInt(args[++i], 10); continue; }
      if (arg === '--owner') { opts.owner = args[++i]; continue; }
      if (arg === '--project') { opts.project = parseInt(args[++i], 10); continue; }
      if (arg === '--title') { opts.title = args[++i]; continue; }
      if (arg === '--body') { opts.body = args[++i]; continue; }
      if (arg === '--reviewer') { opts.reviewer = args[++i]; continue; }
      if (arg === '--assignee') { opts.assignee = args[++i]; continue; }
      // Groom sub-flags and general metadata sub-flags
      if (arg === '--priority') { opts.priority = args[++i]; continue; }
      if (arg === '--size') { opts.size = args[++i]; continue; }
      if (arg === '--agent') { opts.agent = args[++i]; continue; }
      if (arg === '--label') { opts.label = args[++i]; continue; }
      if (arg === '--status') { opts.status = args[++i]; continue; }
      if (arg === '--blueprint') { opts.blueprint = args[++i]; continue; }
    }
  }

  return opts;
}

function printHelp() {
  console.log(`
Usage: node projects.js [options]

Commands:
  --pulse                          Fetch board status (ASCII Table)
  --create-epic TITLE [options]    Create issue, add to project, set metadata
  --blueprint JSON                 Generate nested hierarchies (Epic->Story->Task)
  --ship --issue <n> --title <t>   Push branch and open linked PR
  --groom                          Set all mandatory metadata in one shot
  --set --issue <n> --field <f> --value <v>   Update a single board field
  --link-child --parent <n> --child <n>       Link child issue to parent
  --read-tree <n>                  Fetch full hierarchy of an issue
  --list                           List projects for owner

Options:
  --json                           Output raw data as JSON
  --owner <owner>       Override auto-discovered owner
  --project <number>    Override auto-discovered project number
  --label "bug"                    Add label (used by create-epic and ship)
  --reviewer "username"            Request review (used by ship)
  --assignee "username"            Assign ownership (used by ship, defaults to @me)
  --body "Content"                 Set body for PR (for ship)
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

  if (opts.createEpic) {
    cmdCreateEpic(meta, opts.createEpic, opts, opts.json);
  } else if (opts.blueprint) {
    cmdBlueprint(meta, opts.blueprint, opts.json);
  } else if (opts.readTree) {
    cmdReadTree(meta, opts.readTree, opts.json);
  } else if (opts.ship) {
    if (!opts.issue || !opts.title) {
      console.error("Error: --ship requires --issue <n> and --title <t>");
      process.exit(1);
    }
    cmdShip(meta, opts.issue, opts.title, opts, opts.json);
  } else if (opts.pulse) {
    cmdPulse(meta, opts.json);
  } else if (opts.add) {
    cmdAdd(meta, opts.add, opts.json);
  } else if (opts.groom) {
    if (!opts.issue) {
      if (opts.json) {
        console.log(JSON.stringify({ success: false, error: '--groom requires --issue' }));
      } else {
        console.error('Error: --groom requires --issue.');
      }
      process.exit(1);
    }
    cmdGroom(meta, opts.issue, {
      priority: opts.priority,
      size: opts.size,
      agent: opts.agent,
      label: opts.label,
      status: opts.status,
    }, opts.json);
  } else if (opts.set) {
    if (!opts.issue || !opts.field || !opts.value) {
      if (opts.json) {
        console.log(JSON.stringify({ success: false, error: '--set requires --issue, --field, and --value' }));
      } else {
        console.error('Error: --set requires --issue, --field, and --value.');
      }
      process.exit(1);
    }
    cmdSet(meta, opts.issue, opts.field, opts.value, opts.json);
  } else if (opts.linkChild) {
    if (!opts.parent || !opts.child) {
      if (opts.json) {
        console.log(JSON.stringify({ success: false, error: '--link-child requires --parent and --child' }));
      } else {
        console.error('Error: --link-child requires --parent and --child.');
      }
      process.exit(1);
    }
    cmdLinkChild(meta, opts.parent, opts.child, opts.json);
  } else if (opts.list) {
    cmdList(opts.owner || meta.owner, opts.json);
  } else {
    printHelp();
  }
}

main();
