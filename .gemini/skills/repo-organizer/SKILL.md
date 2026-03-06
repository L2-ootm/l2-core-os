---
description: Use when you need to reorganize files, clean up directories, or restructure a project. ALWAYS prioritizes data safety and git history preservation.
---

# Repo Organizer Skill

## 1. Analysis Phase
**Goal**: Understand the mess before cleaning it.

1.  **Map Structure**:
    - Use `list_dir` or `tree` (via `run_command`) to visualize the current state.
    - Identify "Code Smells" in file organization:
        - Mixed file types (e.g., images mixed with code).
        - Ambiguous folder names (`temp`, `stuff`, `misc`).
        - Deeply nested empty directories.
        - Duplicate files.

2.  **Define Desired State**:
    - Propose a new directory structure based on:
        - **Language/Framework Conventions** (e.g., `src/`, `components/`, `assets/`).
        - **Feature-Based Grouping** (grouping by domain).
        - **User Instructions** (specific requests).

## 2. Planning Phase (The "Dry Run")
**Goal**: Create a safe execution plan that the user can verify.

1.  Create a `REORG_PLAN.md` artifact containing:
    - **Current Path** -> **New Path**.
    - **Method**: `git mv` (preferred) or `mv`.
    - **Reasoning**: Why is this moving?

    ```markdown
    | Current Location | New Location | Method |
    | :--- | :--- | :--- |
    | `main.py` | `src/main.py` | `git mv` |
    | `logo.png` | `assets/img/logo.png` | `git mv` |
    ```

2.  **Constraint Checklist**:
    - [ ] Will this break imports? (Identify files that import the moving files).
    - [ ] Is the destination directory created?
    - [ ] Are there naming conflicts?

## 3. Execution Phase
**Goal**: Move files without losing data or history.

1.  **Pre-Flight**:
    - Ensure `git status` is clean. If not, commit or stash.
    
2.  **Execute Moves**:
    - **Create Directories**: `mkdir -p path/to/new`
    - **Move**: Use `git mv <source> <dest>` to preserve history.
    - **Verify Content**: Check SHA256 matches if not using git (or trust git's mechanism).

3.  **Update References**:
    - Use `grep_search` to find occurrences of the old path/filename.
    - Update imports in code (`import old` -> `import new`).
    - Update relative paths in Markdown/HTML.

## 4. Verification Phase
**Goal**: Ensure the house is still standing.

1.  **Structure Check**: Run `list_dir` on new folders.
2.  **Build/Test**: Run the project's build command or test suite.
3.  **Git Status**: detailed `git status` should show "renamed:".
