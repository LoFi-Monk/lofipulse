$owner = "LoFi-Monk"
$projectNumber = 9

$query = @"
query(`$owner: String!, `$number: Int!) {
  user(login: `$owner) {
    projectV2(number: `$number) {
      title
      items(first: 20) {
        nodes {
          id
          content {
            ... on Issue {
              title
              number
            }
          }
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2FieldCommon { name }
                }
              }
            }
          }
        }
      }
    }
  }
}
"@

$results = gh api graphql -f owner=$owner -F number=$projectNumber -f query=$query | ConvertFrom-Json

if ($results.data.user.projectV2) {
    Write-Host "Project: $($results.data.user.projectV2.title)"
    foreach ($item in $results.data.user.projectV2.items.nodes) {
        $status = $item.fieldValues.nodes | Where-Object { $_.field.name -eq "Status" }
        Write-Host "Issue #$($item.content.number): $($item.content.title) [Status: $($status.name)]"
    }
} else {
    Write-Error "Failed to retrieve project data."
}
