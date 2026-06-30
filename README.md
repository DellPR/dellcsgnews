# 343 Monitor

Static GitHub Pages app for the Dell CSG newsletter stream.

This repository is intended to receive the exported public data from:

- Media Monitor
- YouTube Monitor
- X Watch

The local PC remains responsible for collection, classification and newsletter generation. After each successful newsletter send, `C:\MediaMonitor\monitor_hub_export.py` updates the files in this folder.

## Publishing

1. Clone this repo locally into `C:\MediaMonitor\monitor_hub`, or copy this folder into the cloned repo.
2. Enable GitHub Pages for the repository branch.
3. Set `github.auto_commit` to `true` in `config.json` once local git push works from this machine.

The exporter will then commit and push updated data after successful Media Monitor or YouTube Monitor editions.
