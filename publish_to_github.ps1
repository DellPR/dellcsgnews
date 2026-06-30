$ErrorActionPreference = "Stop"

$Repo = "https://github.com/DellPR/dellcsgnews.git"
$Hub = "C:\MediaMonitor\monitor_hub"

Set-Location $Hub

if (-not (Test-Path ".git")) {
  git init
  git branch -M main
}

$remote = git remote get-url origin 2>$null
if (-not $remote) {
  git remote add origin $Repo
} elseif ($remote -ne $Repo) {
  git remote set-url origin $Repo
}

git add .
git commit -m "Update 343 Monitor web app" 2>$null
git push -u origin main

Write-Host "Published 343 Monitor to $Repo"
