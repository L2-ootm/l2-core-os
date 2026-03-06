# L2 NAMING CONVENTION RULES

> **Status:** Enforced

## 1. Directory Names

### Root Level
Must use **Numeric Prefix** + **UPPER_SNAKE_CASE**.
*   `00_GENESIS`
*   `01_CORE_SYSTEMS`
*   `05_MARKETING`

### Core Systems
Must use **Active Agent** names (`the_noun`).
*   `the_hunter`
*   `the_sentinel`
*   `the_deployer`

### Assets
Must use **Category** + **snake_case**.
*   `ui_kits`
*   `logo_marks`

## 2. File Names

### Documentation
**PascalCase** for human-readable docs.
*   `README.md`
*   `TechnicalSpec.md`

**kebab-case** for technical configurations or skill definitions.
*   `skill.md`
*   `design-tokens.json`

### Assets (Images/SVGs)
**snake_case** with strict taxonomy.
*   `logo_monolith_primary.svg`
*   `icon_dashboard_solid.svg`

## 3. Forbidden Patterns
*   `temp`, `tmp`, `test` (outside of `.gitignore` paths)
*   `Untitled`, `New Folder`
*   Spaces in filenames (`my file.md` -> ❌)
