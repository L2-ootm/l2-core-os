---
name: environment-snapshot
description: Generate comprehensive diagnostic scripts to log the current project and system state (specs, dependencies, processes) for debugging instability.
---

# Environment Snapshot

## Overview

This skill guides the agent in generating a "Snapshot Script" that captures the complete runtime state of the current environment. This is critical for debugging "it works on my machine" issues by comparing logs between different environments.

## When to Use
- **Instability:** When a project behaves differently across machines.
- **Onboarding:** To verify a new dev environment matches the baseline.
- **Bug Reports:** To attach a full context dump to an issue.

## Core Requirements

The generated script (usually PowerShell for Windows or Bash for Linux/Mac) must capture:

1.  **System Metadata:** Hostname, OS version, CPU, RAM, Uptime.
2.  **Runtimes:** Versions of Python, Node, Go, Java, Rust, etc.
3.  **Project Context:**
    - Git branch/commit hash.
    - File listing (tree structure, excluding ignored files).
4.  **Dependencies:**
    - `pip freeze` / `poetry export`
    - `npm list` / `yarn list`
    - `go list -m all`
5.  **Environment Variables:** Dump all env vars (Redact known secrets like `KEY`, `TOKEN`, `SECRET`, `PASSWORD`).
6.  **Running Processes:** Snapshot of relevant active processes.
7.  **Network:** Active ports or simple connectivity checks (optional).

## Output Format

The script should write all output to a single file named `env_snapshot_<TIMESTAMP>.txt` for easy sharing.

## Template: Windows (PowerShell)

Use this as a base for generating the script:

```powershell
$OutputFile = "env_snapshot_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
Start-Transcript -Path $OutputFile

Write-Host "--- SYSTEM INFO ---"
Get-ComputerInfo | Select-Object OsName, OsVersion, CsName, WindowsVersion, CsProcessors, CsPhyicallyInstalledMemory

Write-Host "`n--- RUNTIMES ---"
Write-Host "Node: $(node -v)"
Write-Host "Python: $(python --version 2>&1)"
Write-Host "Git: $(git --version)"

Write-Host "`n--- GIT STATUS ---"
git status
git log -n 1 --oneline

Write-Host "`n--- DEPENDENCIES (Pip) ---"
pip freeze

Write-Host "`n--- PROCESSES (Top 10 by CPU) ---"
Get-Process | Sort-Object CPU -Descending | Select-Object -First 10

Write-Host "`n--- ENV VARS (Redacted) ---"
Get-ChildItem Env: | ForEach-Object {
    if ($_.Name -match "KEY|TOKEN|SECRET|PASSWORD") {
        "$($_.Name)=***REDACTED***"
    } else {
        "$($_.Name)=$($_.Value)"
    }
}

Stop-Transcript
Write-Host "Snapshot saved to $OutputFile"
```

## Instructions

1.  **Analyze Context:** Determine the OS and the relevant languages/tools for the project.
2.  **Generate Script:** Create a custom script (based on the template) that includes specfic commands for this project's stack (e.g., if it's a Rust project, add `cargo --version` and `cargo tree`).
3.  **Save Script:** Save it as `capture_state.ps1` (or `.sh`).
4.  **Run (Optional):** If requested, execute the script to generate the log immediately.
