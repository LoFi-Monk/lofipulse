param (
    [string]$Owner
)

. "$PSScriptRoot/config.ps1"
# For listing projects, we only need the owner
if (-not $Owner) { 
    $repoInfo = gh repo view --json owner | ConvertFrom-Json
    $Owner = $repoInfo.owner.login
}

gh project list --owner $Owner
