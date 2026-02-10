param (
    [Parameter(Mandatory=$true)]
    [int]$IssueNumber,
    [Parameter(Mandatory=$true)]
    [string]$FieldName,
    [Parameter(Mandatory=$true)]
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
if (-not $response.data.user.projectV2) {
    Write-Error "Project #$ProjectNumber not found or not accessible."
    exit 1
}

$projectData = $response.data.user.projectV2
$projectId = $projectData.id

# Find the specific item ID
$item = $projectData.items.nodes | Where-Object { $_.content.number -eq $IssueNumber }
if (-not $item) {
    Write-Error "Issue #$IssueNumber not found on the board. Add it first using add-item.ps1."
    exit 1
}
$itemId = $item.id

# Find the field
$field = $projectData.fields.nodes | Where-Object { $_.name -eq $FieldName }
if (-not $field) { 
    Write-Error "Field '$FieldName' not found available fields: $(($projectData.fields.nodes.name) -join ', ')."
    exit 1 
}

# 2. Construct the Mutuation based on field type
$valueInput = @{}
if ($field.options) {
    # Single Select
    $option = $field.options | Where-Object { $_.name -eq $Value }
    if (-not $option) { 
        Write-Error "Option '$Value' not found for single-select field '$FieldName'. Available options: $(($field.options.name) -join ', ')." 
        exit 1 
    }
    $valueInput = "{ singleSelectOptionId: `"$($option.id)`" }"
} else {
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
} else {
    Write-Error "Failed to update field. GraphQL Error: $($result.errors.message)"
    exit 1
}
