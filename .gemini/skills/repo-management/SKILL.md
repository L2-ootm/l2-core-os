---
name: repo-management
description: Automated L2 standard enforcement. Manages file organization, integrity, and consistency.
---

# REPO MANAGEMENT SKILL

> **Role:** The Librarian & The Janitor.
> **Philosophy:** "A messy repo is a messy mind."

This skill provides the tools and protocols to verify that the L2 repository adheres to the "Dark Luxury" engineering standards.

## 🛠️ Capabilities

### 1. 🧹 File Organization (The Sort)
Enforces the "Snake Case" and "Module" structure.
*   **Rule:** Root folders are `00_UPPER_SNAKE`.
*   **Rule:** Internal assets are `snake_case`.
*   **Rule:** Documentation is `PascalCase` or `kebab-case` (context dependent, needs unifying).

### 2. 🔍 Integrity Check (The Scan)
Verifies that:
*   Every module in `01_CORE_SYSTEMS` has a `README.md`.
*   Every asset in `03_ASSETS_DESIGN` is referenced or documented.
*   No empty directories exist (unless placeholders).
*   No "generic" names like `image.png` or `test.js` exist.

### 3. 🛡️ Inconsistency Detection
*   Checks for duplicate files (content hash).
*   Checks for conflicting "Sources of Truth".

## 🚀 Usage

To run a scan of the current repo:
`analyze_repo_structure` (Concept - automated via subagent)

## 📂 Resources
*   [L2 Standard File Tree](resources/file-tree-standard.md)
*   [Naming Convention Rules](resources/naming-rules.md)
