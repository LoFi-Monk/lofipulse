param (
  [Parameter(Mandatory = $true)]
  [int]$IssueNumber,
  [string]$Owner,
  [string]$Repo,
  [int]$ProjectNumber
)

. "$PSScriptRoot/config.ps1"
$meta = Get-ProjectMetadata

# Override with params if provided, otherwise use discovered meta
if (-not $Owner) { $Owner = $meta.owner }
if (-not $Repo) { $Repo = $meta.repo }
if (-not $ProjectNumber) { $ProjectNumber = $meta.projectNumber }

# 1. Get Issue ID
$issueInfo = gh issue view $IssueNumber --repo "$Owner/$Repo" --json id | ConvertFrom-Json
if (-not $issueInfo) {
  Write-Error "Issue #$IssueNumber not found in $Owner/$Repo."
  exit 1
}
$issueId = $issueInfo.id

# 2. Get Project ID
if ($ProjectNumber -eq $meta.projectNumber) {
  $projectId = $meta.projectId
}
else {
  $projectInfo = gh project view $ProjectNumber --owner $Owner --format json | ConvertFrom-Json
  if (-not $projectInfo) {
    Write-Error "Project #$ProjectNumber not found for owner $Owner."
    exit 1
  }
  $projectId = $projectInfo.id
}

# 3. Add to Project
$query = @"
mutation(`$projectId: ID!, `$contentId: ID!) {
  addProjectV2ItemById(input: {projectId: `$projectId, contentId: `$contentId}) {
    item { id }
  }
}
"@

$result = gh api graphql -f projectId=$projectId -f contentId=$issueId -f query=$query | ConvertFrom-Json
if ($result.data.addProjectV2ItemById.item.id) {
  Write-Host "Successfully added Issue #$IssueNumber to Project #$ProjectNumber ($($meta.owner)/$($meta.repo))"
}
else {
  Write-Error "Failed to add item. GraphQL Error: $($result.errors.message)"
  exit 1
}
