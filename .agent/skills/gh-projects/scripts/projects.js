#!/usr/bin/env node
/**
 * GitHub Projects V2 — Node.js Edition
 *
 * Consolidates all gh-projects PowerShell scripts into a single portable file.
 * Zero npm dependencies. Auth handled by `gh` CLI.
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Helpers ────────────────────────────────────────────────────────────────

function runGraphQL(query, variables = {}) {
  const tmpFile = path.join(os.tmpdir(), `gh-query-${Date.now()}.graphql`);
  try {
    fs.writeFileSync(tmpFile, query, "utf-8");

    const varArgs = Object.entries(variables)
      .map(([k, v]) => {
        // Use -F for integers, -f for strings
        const flag = typeof v === "number" ? "-F" : "-f";
        return `${flag} ${k}=${v}`;
      })
      .join(" ");

    const cmd = `gh api graphql -F query=@"${tmpFile}" ${varArgs}`;
    const raw = execSync(cmd, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const data = JSON.parse(raw);

    if (data.errors) {
      console.error("GraphQL Error:", JSON.stringify(data.errors, null, 2));
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error executing GraphQL:", err.stderr || err.message);
    return null;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {}
  }
}

function gh(args) {
  try {
    return execSync(`gh ${args}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    console.error(`gh ${args} failed:`, err.stderr || err.message);
    return null;
  }
}

// ─── Auto-Discovery (replaces config.ps1) ───────────────────────────────────

function getProjectMetadata() {
  const owner = gh('repo view --json owner --jq ".owner.login"');
  const repo = gh('repo view --json name --jq ".name"');

  if (!owner || !repo) {
    console.error(
      "Auto-Discovery Failed: Could not resolve repository metadata.",
    );
    process.exit(1);
  }

  const projectsRaw = gh(`project list --owner ${owner} --format json`);
  if (!projectsRaw) {
    console.error(
      `Auto-Discovery Failed: Could not list projects for owner '${owner}'.`,
    );
    process.exit(1);
  }

  const projects = JSON.parse(projectsRaw);
  const project = projects.projects.find((p) => p.title === repo);

  if (!project) {
    console.error(
      `Auto-Discovery Failed: No GitHub Project found with title '${repo}' for owner '${owner}'.`,
    );
    process.exit(1);
  }

  return { owner, repo, projectNumber: project.number, projectId: project.id };
}

// ─── Commands ───────────────────────────────────────────────────────────────

function cmdPulse(meta) {
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          items(first: 100) {
            nodes {
              content {
                ... on Issue {
                  number
                  title
                  labels(first: 5) { nodes { name } }
                }
              }
              fieldValues(first: 20) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                  ... on ProjectV2ItemFieldTextValue {
                    text
                    field { ... on ProjectV2FieldCommon { name } }
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query, {
    owner: meta.owner,
    number: meta.projectNumber,
  });
  if (!result) {
    console.error("Failed to fetch board.");
    process.exit(1);
  }

  const items = result.data.user.projectV2.items.nodes.filter(
    (n) => n.content?.number,
  );

  if (items.length === 0) {
    console.log("No items on the board.");
    return;
  }

  // Build table rows
  const rows = items.map((item) => {
    const fields = item.fieldValues.nodes;
    const getField = (name) => {
      const f = fields.find((fv) => fv.field?.name === name);
      return f?.name || f?.text || "";
    };

    return {
      ID: item.content.number,
      Title:
        item.content.title.length > 30
          ? item.content.title.slice(0, 27) + "..."
          : item.content.title,
      Status: getField("Status"),
      Priority: getField("Priority"),
      Labels: (item.content.labels?.nodes || []).map((l) => l.name).join(", "),
    };
  });

  // Print as formatted table
  const cols = ["ID", "Title", "Status", "Priority", "Labels"];
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c]).length)),
  );

  const header = cols.map((c, i) => c.padEnd(widths[i])).join("  ");
  const separator = widths.map((w) => "-".repeat(w)).join("  ");

  console.log(header);
  console.log(separator);
  rows.forEach((r) => {
    console.log(cols.map((c, i) => String(r[c]).padEnd(widths[i])).join("  "));
  });
}

function cmdAdd(meta, issueNumber) {
  // Get Issue ID
  const issueRaw = gh(
    `issue view ${issueNumber} --repo "${meta.owner}/${meta.repo}" --json id`,
  );
  if (!issueRaw) {
    console.error(`Issue #${issueNumber} not found.`);
    process.exit(1);
  }
  const issueId = JSON.parse(issueRaw).id;

  // Get Project ID (respect explicit project number)
  const projectId = meta.projectId;

  const query = `
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
        item { id }
      }
    }
  `;

  const result = runGraphQL(query, { projectId, contentId: issueId });
  if (result?.data?.addProjectV2ItemById?.item?.id) {
    console.log(
      `Added Issue #${issueNumber} to Project #${meta.projectNumber}`,
    );
  } else {
    console.error("Failed to add item.");
    process.exit(1);
  }
}

function cmdSet(meta, issueNumber, fieldName, value) {
  // Fetch project items and fields in one query
  const query = `
    query($owner: String!, $number: Int!) {
      user(login: $owner) {
        projectV2(number: $number) {
          id
          items(first: 100) {
            nodes {
              id
              content { ... on Issue { number } }
            }
          }
          fields(first: 30) {
            nodes {
              ... on ProjectV2Field { id name }
              ... on ProjectV2IterationField { id name }
              ... on ProjectV2SingleSelectField {
                id
                name
                options { id name }
              }
            }
          }
        }
      }
    }
  `;

  const result = runGraphQL(query, {
    owner: meta.owner,
    number: meta.projectNumber,
  });
  if (!result?.data?.user?.projectV2) {
    console.error(
      `Project #${meta.projectNumber} not found or not accessible.`,
    );
    process.exit(1);
  }

  const projectData = result.data.user.projectV2;
  const projectId = projectData.id;

  // Find the item
  const item = projectData.items.nodes.find(
    (n) => n.content?.number === issueNumber,
  );
  if (!item) {
    console.error(
      `Issue #${issueNumber} not found on the board. Add it first using --add.`,
    );
    process.exit(1);
  }

  // Find the field
  const field = projectData.fields.nodes.find((f) => f.name === fieldName);
  if (!field) {
    const available = projectData.fields.nodes
      .map((f) => f.name)
      .filter(Boolean)
      .join(", ");
    console.error(`Field '${fieldName}' not found. Available: ${available}`);
    process.exit(1);
  }

  // Build value input based on field type
  let valueInput;
  if (field.options) {
    // Single Select
    const option = field.options.find((o) => o.name === value);
    if (!option) {
      const available = field.options.map((o) => o.name).join(", ");
      console.error(
        `Option '${value}' not found for '${fieldName}'. Available: ${available}`,
      );
      process.exit(1);
    }
    valueInput = `{"singleSelectOptionId": "${option.id}"}`;
  } else {
    valueInput = `{"text": "${value}"}`;
  }

  const mutation = `
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2PropertyValue!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId
        itemId: $itemId
        fieldId: $fieldId
        value: $value
      }) {
        projectV2Item { id }
      }
    }
  `;

  const mutResult = runGraphQL(mutation, {
    projectId,
    itemId: item.id,
    fieldId: field.id,
    value: valueInput,
  });

  if (mutResult?.data?.updateProjectV2ItemFieldValue?.projectV2Item?.id) {
    console.log(`Set ${fieldName} to '${value}' for Issue #${issueNumber}`);
  } else {
    console.error("Failed to update field.");
    process.exit(1);
  }
}

function cmdLinkChild(meta, parentNumber, childNumber) {
  const parentRaw = gh(
    `issue view ${parentNumber} --repo "${meta.owner}/${meta.repo}" --json id`,
  );
  const childRaw = gh(
    `issue view ${childNumber} --repo "${meta.owner}/${meta.repo}" --json id`,
  );

  if (!parentRaw) {
    console.error(`Parent Issue #${parentNumber} not found.`);
    process.exit(1);
  }
  if (!childRaw) {
    console.error(`Child Issue #${childNumber} not found.`);
    process.exit(1);
  }

  const parentId = JSON.parse(parentRaw).id;
  const childId = JSON.parse(childRaw).id;

  const mutation = `
    mutation($parentId: ID!, $childId: ID!) {
      addSubIssue(input: {issueId: $parentId, subIssueId: $childId}) {
        issue { id title }
      }
    }
  `;

  const result = runGraphQL(mutation, { parentId, childId });
  if (result?.data?.addSubIssue?.issue?.id) {
    console.log(
      `Linked Issue #${childNumber} as sub-issue of #${parentNumber}`,
    );
  } else {
    console.error("Failed to link sub-issue.");
    process.exit(1);
  }
}

function cmdList(owner) {
  const raw = gh(`project list --owner ${owner}`);
  if (raw) console.log(raw);
}

// ─── CLI Argument Parsing ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      opts.help = true;
      continue;
    }
    if (arg === "--pulse") {
      opts.pulse = true;
      continue;
    }
    if (arg === "--list") {
      opts.list = true;
      continue;
    }

    // Flags with values
    if (i + 1 < args.length) {
      if (arg === "--add") {
        opts.add = parseInt(args[++i], 10);
        continue;
      }
      if (arg === "--set") {
        opts.set = true;
        continue;
      }
      if (arg === "--issue") {
        opts.issue = parseInt(args[++i], 10);
        continue;
      }
      if (arg === "--field") {
        opts.field = args[++i];
        continue;
      }
      if (arg === "--value") {
        opts.value = args[++i];
        continue;
      }
      if (arg === "--link-child") {
        opts.linkChild = true;
        continue;
      }
      if (arg === "--parent") {
        opts.parent = parseInt(args[++i], 10);
        continue;
      }
      if (arg === "--child") {
        opts.child = parseInt(args[++i], 10);
        continue;
      }
      if (arg === "--owner") {
        opts.owner = args[++i];
        continue;
      }
      if (arg === "--project") {
        opts.project = parseInt(args[++i], 10);
        continue;
      }
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
  --set --issue <n> --field <f> --value <v>   Update a board field
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

  // Override with explicit params if provided
  if (opts.owner) meta.owner = opts.owner;
  if (opts.project) meta.projectNumber = opts.project;

  if (opts.pulse) {
    cmdPulse(meta);
  } else if (opts.add) {
    cmdAdd(meta, opts.add);
  } else if (opts.set) {
    if (!opts.issue || !opts.field || !opts.value) {
      console.error("Error: --set requires --issue, --field, and --value.");
      process.exit(1);
    }
    cmdSet(meta, opts.issue, opts.field, opts.value);
  } else if (opts.linkChild) {
    if (!opts.parent || !opts.child) {
      console.error("Error: --link-child requires --parent and --child.");
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
