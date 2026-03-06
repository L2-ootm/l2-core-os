---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies. Mix Gemini (for fire-and-forget) and Kilo (for deep architectural reasoning via TUI). LIMIT TO 2 AGENTS AT A TIME.
---

# Dispatching Parallel Agents

## Overview

When you have multiple unrelated tasks (different files, different subsystems, different deliverables), working on them sequentially wastes time. Each task is independent and can happen in parallel.

**Core principle:** Dispatch one agent per independent problem domain using the `gemini` CLI or `kilo` CLI. Let them work concurrently.

> ⚠️ **RATE LIMIT WARNING:** Dispatch **maximum 2 agents at a time** — **1 Gemini + 1 Kilo per batch**.
> Using the same CLI engine twice in one batch risks hitting API rate limits.
> If you have 6 tasks, dispatch in 3 batches of 2 (1 gemini + 1 kilo each).

> 🚀 **THE TWO PARADIGMS:** 
> - **Gemini CLI (`gemini --yolo`):** Fast, headless, fire-and-forget. Best for documentation, simple scaffolding, and generating quick files.
> - **Kilocode TUI (`kilo`):** Deep, rigorous, interactive. Best for ultra-complex coding tasks, architectures, and holistic reasoning. Requires a strict UI-based workflow using `@file` injection.

## When to Use

**Use when:**
- 2+ independent deliverables (files, features, documentation)
- Each task can be understood without context from others
- No shared state between tasks
- Tasks write to different files

**Don't use when:**
- Tasks are related (output of A is input to B)
- Need to understand full system state
- Agents would interfere (editing same files)

---

## 🏗️ The execution Pattern

### 1. Identify Independent Tasks

Group by deliverable:
- Task A: Create system prompt for Sales Agent → `DAVI_SALES.md` (Gemini: Simple, text-heavy)
- Task B: Architect a complex Payment Engine → `engine.ts` (Kilo: Needs codebase context, complex logic)

### 2. The Gemini Pattern (Headless)

For simpler tasks, use `gemini --yolo` with a direct string prompt in a background terminal.

```javascript
// BATCH 1: Gemini Task
run_command({
  CommandLine: 'gemini --yolo "Create X. Write to path/file1.md. Context: ..."',
  WaitMsBeforeAsync: 500,
  SafeToAutoRun: true
});
```

### 3. The Kilo Pattern (TUI + Injection)

**CRITICAL:** Kilo handles massive codebases but struggles with complex prompts passed directly via the CLI due to shell escaping and UI blocking. 

For Kilo you MUST use the **TUI + File Injection Pattern**:

#### Step 3A: Write an Ultra-Rigid Directive File
First, write an extremely detailed, rigid, architect-level prompt to a file (e.g., `docs/directives/PAYMENT_AGENT.md`). Treat this like giving instructions to a Senior Staff Engineer.
- Define Exact Brand/Code specs (colors, fonts, stack)
- Define Geometric/Mathematical rules if dealing with UI/SVG.
- Tell them exactly what files to edit and how.

#### Step 3B: Launch the Kilo TUI
Launch Kilo interactively in the background. DO NOT pass `--auto` or prompt strings here.

```javascript
run_command({
  CommandLine: 'kilo',
  WaitMsBeforeAsync: 5000, 
  SafeToAutoRun: true
});
```

#### Step 3C: Inject the Directive via standard input
Once the TUI is running (verify via `command_status`), inject the file using the `@` symbol so Kilo reads the massive prompt perfectly, alongside instructions.

```javascript
send_command_input({
  CommandId: '<THE_KILO_COMMAND_ID>',
  Input: '@docs/directives/PAYMENT_AGENT.md Please execute this directive exactly as written.\n',
  SafeToAutoRun: true,
  WaitMs: 3000
});
```

### 4. Fire-and-Forget (Parallelism)

After injecting the Kilo prompt and dispatching the Gemini command... IMMEDIATELY CONTINUE WITH YOUR OWN USEFUL WORK (e.g., writing other code, updating docs, creating schemas). 
Do NOT sit idly checking their status. The subagents will complete independently.
This enables real parallelism: you work + agents work = 2x output.

---

## Agent Prompt Structure (The "Super Prompt")

To get good results, especially from Kilo, your directives must be **Ultra-Complex and Rigid**.

**Template for Directive File (`.md`):**

```markdown
# [Component/Task Name] Engineering Directive

## Context & Philosophy
[What are we building? What is the overarching vibe/architecture?]
Example: "We are building a High-Frequency Trading UI. The aesthetic is Dark Luxury Terminal. Speed is critical."

## Technical Constraints & Parameters
- Stack: [Next.js 14, Tailwind, etc.]
- Styling: [Strict colors, specific tailwind utility classes to use, exact spacing rules]
- Dependencies: [What libraries to use vs avoid]

## Your Mission
You are a Staff-Level Engineer. Your task is to conceptualize, rigorously define, and architect [X].
Do not stop until the requirement is perfectly implemented.

## Deliverable
Build [Exact Path].
1. Section 1 rules
2. Mathematical/Architectural constraints
3. Edge case handling

## Anti-Patterns
- [What MUST they avoid doing?]
```

---

## Common Mistakes

**❌ Passing massive prompts to `kilo run`:** Shell escaping breaks, the UI bugs out, and it fails.
**✅ TUI Pattern:** Launch `kilo`, then `send_command_input` with `@file.md`.

**❌ Weak Prompts:** "Make a logo" → Agent generates generic garbage.
**✅ Super Prompts:** "Use Medical Teal #0891B2. Boolean intersection of two circles radius R. 1.5px stroke."

**❌ Blocking execution:** Waiting for agents.
**✅ Fire-and-forget:** Send the inputs, move to your next task!

**❌ Too many parallel:** Dispatching 6 agents at once → rate limits
**✅ Batch of 2:** Dispatch 1 Gemini + 1 Kilo, wait, dispatch next pair.
