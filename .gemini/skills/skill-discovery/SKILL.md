---
name: skill-discovery
description: Find and adapt external agent skills/plugins to the local environment, specifically from trusted community repositories like wshobson/agents.
---

# Skill Discovery

## Overview

This skill enables the agent to expand its capabilities by discovering, retrieving, and adapting skills or plugins from external repositories. It specifically targets the `wshobson/agents` repository but can be adapted for others. It bridges the gap between external community resources and the local internal skill format.

**Default Source:** `https://github.com/wshobson/agents/tree/main/plugins/`

## Process

### 1. Identify Need & Search
**Input:** User request (e.g., "enhance security", "add seo capabilities")
**Action:**
1.  Navigate to the source repository (e.g., via `browser_subagent` or `read_url_content`).
2.  Scan the list of available plugins/folders.
3.  Identify the plugin that best matches the user's need.

### 2. Retrieve Content
**Action:**
1.  Read the content of the identified plugin.
    - Look for main instruction files (e.g., `README.md`, `plugin_prompt.md`, `.py` logic).
    - Note any dependencies or specific configurations.

### 3. Adapt to Local Format
**Action:**
1.  Create a new directory in `c:\Users\Davi\.gemini\antigravity\knowledge\skills\<skill-name>`.
2.  Create a `SKILL.md` file following the **Standard Skill Template**.
3.  **Transformation Rules:**
    - **Name:** Use the plugin name (kebab-case).
    - **Description:** summarize the plugin's purpose.
    - **Instructions:** Convert the plugin's logic/prompt into the `SKILL.md` body.
    - **Structure:** Organize into "When to Use", "Core Concepts", and "Instructions".

**Standard Skill Template:**
```markdown
---
name: <skill-name>
description: <concise-description>
---

# <Skill Title>

## When to Use
<list of scenarios>

## Overview
<description of what the skill does>

## Instructions / Core Logic
<adapted content from the external plugin>
```

### 4. Install & Verify
**Action:**
1.  Save the `SKILL.md` file.
2.  Notify the user of the new skill installation.
3.  (Optional) Test the skill immediately if relevant.

## Example Usage

**User:** "Find a skill to help with SEO."

**Agent:**
1.  **Browses** `https://github.com/wshobson/agents/tree/main/plugins/`.
2.  **Finds** `seo-optimizer` (hypothetical).
3.  **Reads** `seo-optimizer/README.md`.
4.  **Creates** `knowledge/skills/seo-optimizer/SKILL.md`.
5.  **Adapts** content: "Use this skill to optimize page titles and meta tags..."
6.  **Saves** and **Reports**: "Installed `seo-optimizer` skill."

## Red Flags - STOP

- **Direct Copying without Adaptation:** Do not just dump the raw file. You must format it as a valid `SKILL.md`.
- **Malicious Code:** Briefly review for obvious malicious commands (e.g., `rm -rf /`, exfiltration) before creating.
- **Irrelevant Matches:** If no good match is found, report failure instead of installing a random skill.

## Tools
- `browser_subagent`: Essential for navigating GitHub web interfaces.
- `read_url_content`: Useful for reading raw file content if URLs are known.
- `write_to_file`: For saving the new skill.
