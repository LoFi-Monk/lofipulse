param (
    [string]$Owner = "LoFi-Monk",
    [int]$ProjectNumber = 9
)

$query = @"
query(`$owner: String!, `$number: Int!) {
  user(login: `$owner) {
    projectV2(number: `$number) {
      items(first: 50) {
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              state
              assignees(first: 5) {
                nodes { login }
              }
              labels(first: 5) {
                nodes { name }
              }
            }
          }
          fieldValues(first: 10) {
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
$items = $response.data.user.projectV2.items.nodes

$queue = @()

foreach ($item in $items) {
    if ($item.content.number) {
        $status = $item.fieldValues.nodes | Where-Object { $_.field.name -eq "Status" } | Select-Object -ExpandProperty name
        $priority = $item.fieldValues.nodes | Where-Object { $_.field.name -eq "Priority" } | Select-Object -ExpandProperty name
        
        $queue += [PSCustomObject]@{
            ID       = $item.content.number
            Title    = $item.content.title
            Status   = $status
            Priority = $priority
            Labels   = ($item.content.labels.nodes.name -join ", ")
        }
    }
}

$queue | Format-Table -AutoSize
