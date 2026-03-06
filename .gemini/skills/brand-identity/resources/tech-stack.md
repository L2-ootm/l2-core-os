# L2 Systems // Tech Stack & Engineering Standards

> "Code without documentation is legacy code the moment it's written."

## 🛠️ Core Technology

### 1. Languages & Runtimes
*   **Python (3.10+):** The primary language for backend, automation, and AI agents.
*   **Node.js (LTS):** For web applications, frontend tooling, and specific async IO tasks.
*   **PowerShell:** For local automation and scripts on Windows.

### 2. Frameworks
*   **Frontend:** standard web (HTML/CSS3) or Next.js (only if complex).
*   **Styles:** Vanilla CSS (preferred) or TailwindCSS (if requested). **NO Bootstrap.**
*   **Resources:** [shoogle.dev](https://shoogle.dev/) (Shadcn/UI Blocks) for Next.js projects.
*   **Backend:** FastAPI (Python) or Express (Node).

### 3. AI & Automation
*   **Agents:** Uses `gemini` CLI and `antigravity` framework.
*   **Workflows:** n8n for glue code / integration piping.
*   **Vector DB:** ChromaDB or Pinecone.

---

## 📂 Project Structure Standard

All L2 projects must follow this tree:

\`\`\`text
[PROJECT-ROOT]/
│
├── 📁 .github/              # CI/CD
├── 📁 docs/                 # Documentation (REQUIRED)
│   ├── 📁 assets/
│   └── 📄 ARCHITECTURE.md
│
├── 📁 src/                  # Source Code
├── 📁 tests/                # Automated Tests
├── 📁 dev-utils/            # Local dev tools
├── 📁 scripts/              # Deploy/Setup scripts
│
├── 📄 .env.example          # NEVER commit .env
├── 📄 README.md             # Must follow L2 Master Template
└── 📄 requirements.txt      # or package.json
\`\`\`

## 📝 Rules of Engagement

1.  **Docs First:** Check `docs/` before writing code.
2.  **No Fluff:** Comments should explain *why*, not *what*.
3.  **Idempotency:** Scripts must be runnable multiple times without side effects.
4.  **ASCII Art:** All CLI tools must have a cool ASCII banner.
