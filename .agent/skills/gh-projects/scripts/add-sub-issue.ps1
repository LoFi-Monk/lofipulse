param (
  [int]$ParentIssueNumber,
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

$parentId = $parentInfo.id
$childId = $childInfo.id

if (-not $parentId -or -not $childId) {
  Write-Error "Could not find one or both issues."
  exit 1
}

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
  Write-Error "Failed to link sub-issue."
}
