param (
  [Parameter(Mandatory = $true)]
  [int]$ParentIssueNumber,
  [Parameter(Mandatory = $true)]
  [int]$ChildIssueNumber,
  [string]$Owner,
  [string]$Repo
)

. "$PSScriptRoot/config.ps1"
$meta = Get-ProjectMetadata

if (-not $Owner) { $Owner = $meta.owner }
if (-not $Repo) { $Repo = $meta.repo }

# 1. Get Global IDs for both issues
$parentInfo = gh issue view $ParentIssueNumber --repo "$Owner/$Repo" --json id | ConvertFrom-Json
$childInfo = gh issue view $ChildIssueNumber --repo "$Owner/$Repo" --json id | ConvertFrom-Json

if (-not $parentInfo) { Write-Error "Parent Issue #$ParentIssueNumber not found."; exit 1 }
if (-not $childInfo) { Write-Error "Child Issue #$ChildIssueNumber not found."; exit 1 }

$parentId = $parentInfo.id
$childId = $childInfo.id

# 2. Add Sub-issue via GraphQL
$mutation = @"
mutation(`$parentId: ID!, `$childId: ID!) {
  addSubIssue(input: {issueId: `$parentId, subIssueId: `$childId}) {
    issue {
      id
      title
    }
  }
}
"@

$result = gh api graphql -f parentId=$parentId -f childId=$childId -f query=$mutation | ConvertFrom-Json

if ($result.data.addSubIssue.issue.id) {
  Write-Host "Successfully linked Issue #$ChildIssueNumber as a sub-issue of #$ParentIssueNumber"
}
else {
  Write-Error "Failed to link sub-issue. GraphQL Error: $($result.errors.message)"
  exit 1
}
