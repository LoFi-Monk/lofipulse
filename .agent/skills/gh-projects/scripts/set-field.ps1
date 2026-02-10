param (
  [int]$IssueNumber,
  [string]$FieldName,
  [string]$Value,
  [string]$Owner,
  [int]$ProjectNumber
)

. "$PSScriptRoot/config.ps1"
$meta = Get-ProjectMetadata

if (-not $Owner) { $Owner = $meta.owner }
if (-not $ProjectNumber) { $ProjectNumber = $meta.projectNumber }

# 1. Get the Project V2 Item ID and Field Metadata
$queryGetItem = @"
query(`$owner: String!, `$number: Int!) {
  user(login: `$owner) {
    projectV2(number: `$number) {
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
"@

$response = gh api graphql -f owner=$Owner -F number=$ProjectNumber -f query=$queryGetItem | ConvertFrom-Json
$projectData = $response.data.user.projectV2
$projectId = $projectData.id

# Find the specific item ID
$item = $projectData.items.nodes | Where-Object { $_.content.number -eq $IssueNumber }
$itemId = $item.id

if (-not $itemId) {
  Write-Error "Issue #$IssueNumber not found on the board."
  exit 1
}

# Find the field
$field = $projectData.fields.nodes | Where-Object { $_.name -eq $FieldName }
if (-not $field) { Write-Error "Field '$FieldName' not found."; exit 1 }

# 2. Construct the Mutuation based on field type
$valueInput = @{}
if ($field.options) {
  # Single Select
  $option = $field.options | Where-Object { $_.name -eq $Value }
  if (-not $option) { Write-Error "Option '$Value' not found for single-select field '$FieldName'."; exit 1 }
  $valueInput = "{ singleSelectOptionId: `"$($option.id)`" }"
}
else {
  # Text or Number
  $valueInput = "{ text: `"$Value`" }"
}

$mutation = @"
mutation(`$projectId: ID!, `$itemId: ID!, `$fieldId: ID!, `$value: ProjectV2PropertyValue!) {
  updateProjectV2ItemFieldValue(input: {
    projectId: `$projectId
    itemId: `$itemId
    fieldId: `$fieldId
    value: `$value
  }) {
    projectV2Item { id }
  }
}
"@

$result = gh api graphql -f projectId=$projectId -f itemId=$itemId -f fieldId=$field.id -f value=$valueInput -f query=$mutation | ConvertFrom-Json

if ($result.data.updateProjectV2ItemFieldValue.projectV2Item.id) {
  Write-Host "Successfully set $FieldName to '$Value' for Issue #$IssueNumber"
}
else {
  Write-Error "Failed to update field."
}
