param (
  [string]$Owner,
  [int]$ProjectNumber
)

. "$PSScriptRoot/config.ps1"
$meta = Get-ProjectMetadata

if (-not $Owner) { $Owner = $meta.owner }
if (-not $ProjectNumber) { $ProjectNumber = $meta.projectNumber }

$query = @"
query(`$owner: String!, `$number: Int!) {
  user(login: `$owner) {
    projectV2(number: `$number) {
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
"@

$response = gh api graphql -f owner=$Owner -F number=$ProjectNumber -f query=$query | ConvertFrom-Json
$items = $response.data.user.projectV2.items.nodes | Where-Object { $_.content.number }

$queue = $items | ForEach-Object {
  $status = $_.fieldValues.nodes | Where-Object { $_.field.name -eq "Status" } | Select-Object -ExpandProperty name
  $priority = $_.fieldValues.nodes | Where-Object { $_.field.name -eq "Priority" } | Select-Object -ExpandProperty name
    
  [PSCustomObject]@{
    ID       = $_.content.number
    Title    = $_.content.title
    Status   = $status
    Priority = $priority
    Labels   = ($_.content.labels.nodes.name -join ", ")
  }
}

$queue | Format-Table -AutoSize
