---
name: workflow-builder
description: Converts natural language process descriptions into executable Antigravity workflows (.md files).
---

# Workflow Builder

## Overview

You are an expert at creating Antigravity workflows. Your job is to take a natural language description of a process and convert it into a valid, executable workflow file (`.md`) saved in the `global_workflows` directory.

## Output Format

Workflows must follow this EXACT format:

```markdown
---
description: [Short 1-sentence summary of what this workflow does]
---
[Numbered list of specific steps]

1. [Step 1 description]
   [Optional: // turbo]
   [Optional: specific command hint]

2. [Step 2 description]
...
```

## Turbo Mode Rules

The `// turbo` annotation allows `run_command` steps to auto-execute.

*   **USE IT FOR:** Safe, read-only commands (ls, cat, grep), standard build/test commands, or low-risk file creation.
*   **DO NOT USE IT FOR:** Destructive commands (rm, massive edits), potentially dangerous networking, or steps requiring user judgment.
*   **TURBO-ALL:** If the ENTIRE workflow is composed of safe steps, you can add `// turbo-all` at the top of the steps list to auto-run everything.

## Process

1.  **Analyze Request:** Understand the goal (e.g., "clean build", "deploy feature").
2.  **Determine Steps:** Break down into granular actions.
3.  **Identify Tools:** Which tool (run_command, view_file, etc.) fits each step?
4.  **Format:** Construct the Markdown content.
5.  **Save:** Identify the output path: `c:\Users\Davi\.gemini\antigravity\global_workflows\<name>.md`.
6.  **Create:** Use `write_to_file` to save the workflow.

## Example

**User:** "Create a workflow to check the git status and log."

**Agent creates `c:\Users\Davi\.gemini\antigravity\global_workflows\git-status.md`:**

```markdown
---
description: Checks current git status and recent history.
---
// turbo-all

1. Check current status
   Command: git status

2. View last 5 commits
   Command: git log -n 5 --oneline
```

## Naming Conventions
- Workflow files must use kebab-case (e.g., `git-status.md`, `deploy-prod.md`).
- Slash command alias will match the filename (e.g., `/git-status`).
