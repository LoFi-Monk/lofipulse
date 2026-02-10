function Get-ProjectMetadata {
    # 1. Resolve Owner and Repo using native JQ filters
    $owner = (gh repo view --json owner --jq ".owner.login" | Out-String).Trim()
    $repo = (gh repo view --json name --jq ".name" | Out-String).Trim()

    if (-not $owner -or -not $repo) {
        Write-Error "Auto-Discovery Failed: Could not resolve repository metadata."
        exit 1
    }

    # 2. Discover Project (matching repo title to project title)
    $projectJson = (gh project list --owner $owner --format json | Out-String).Trim()
    $projects = $projectJson | ConvertFrom-Json
    
    $project = $projects.projects | Where-Object { $_.title -eq $repo }

    if (-not $project) {
        Write-Error "Auto-Discovery Failed: No GitHub Project found with title '$repo' for owner '$owner'."
        exit 1
    }

    return [PSCustomObject]@{
        owner         = $owner
        repo          = $repo
        projectNumber = $project.number
        projectId     = $project.id
    }
}
