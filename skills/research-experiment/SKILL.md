---
name: research-experiment
description: Run end-to-end scientific research experiments using Denario and HAL's toolchain. Trigger when the user wants to analyze a codebase/dataset, generate a research paper, run a scientific experiment, or produce an academic PDF. Covers topic selection, Denario pipeline (idea → methods → results → paper), Codex review, LaTeX compilation, and distribution.
---

# Research Experiment Workflow

Run scientific research experiments using Denario's multi-agent pipeline with HAL's infrastructure.

## Prerequisites

- Denario installed at `/home/debian/clawd/home/Workspace/Denario`
- API keys in `/home/debian/clawd/home/Workspace/Denario/.env` (OPENAI, GOOGLE, ANTHROPIC)
- XeLaTeX: `sudo apt install texlive-xetex texlive-publishers` (for APS/Nature paper formats)

## Quick Start

```bash
source /home/debian/clawd/home/Workspace/Denario/.venv/bin/activate
```

```python
from denario import Denario, Journal
den = Denario(project_dir="my_project")
den.set_data_description("...")  # Step 1
den.get_idea()                    # Step 2
den.get_method()                  # Step 3
den.get_results()                 # Step 4
den.get_paper(journal=Journal.APS) # Step 5
```

## End-to-End Workflow

### 1. Source Material Preparation

Clone or gather source material into workspace:
```bash
cd ~/clawd/home && git clone <repo_url>
```

File findings to Phriction wiki under `/codebases/` or `/articles/` for reference.

### 2. Create Data Description

Use Codex or write manually. The `data_description.md` must include:
- What the data/codebase contains
- Key concepts and terminology
- Research questions or angles
- Available tools and libraries

**Tip:** Spawn a Codex subagent to generate this from a cloned repo:
```
codex exec "Read this repo and create a data_description.md for Denario research..."
```

### 3. Run Denario Pipeline

Each step runs a multi-agent system (control + engineer agents, maker/hater adversarial loop).

```python
den = Denario(project_dir="/home/debian/clawd/home/Workspace/Denario/projects/<name>")
den.set_data_description(open("data_description.md").read())
den.get_idea()    # ~90s, adversarial refinement
den.get_method()  # Generates full methodology
den.get_results() # ⚠️ Tries to EXECUTE experiments — see caveats
den.get_paper(journal=Journal.APS)
```

Run in background sessions — each step can take 2-15 minutes.

### 4. Known Issues & Workarounds

| Issue | Workaround |
|-------|-----------|
| `get_results()` needs specific hardware (GPU, M4, etc.) | Write `results.md` manually or use synthetic data |
| `python` not found (only `python3`) | `sudo ln -s /usr/bin/python3 /usr/local/bin/python` |
| File path errors in cmbagent executor | Copy source files into Denario's project `input_files/` dir |
| OOM on paper generation | Run `get_paper()` separately after killing other processes |
| Missing LaTeX packages | `sudo apt install texlive-xetex texlive-publishers texlive-science` |
| Missing `revtex4-2` class | `sudo apt install texlive-publishers` |

### 5. Manual Assembly Fallback

If `get_paper()` fails or produces partial output, assemble manually:

```latex
\documentclass[aps,prl,twocolumn]{revtex4-2}
\begin{document}
\title{...}
\author{...}
% Paste generated sections from input_files/
\end{document}
```

Compile: `xelatex assembled_draft.tex`

### 6. Review

Have Codex review the output:
```bash
codex -c model=gpt-5.2-codex exec "Review this abstract for weaknesses: ..."
```

Key review dimensions: clarity, methodology specificity, jargon definition, contribution type.

### 7. Distribution

- **CDN:** `sudo cp paper.pdf /var/www/cdn.phantastic.ai/<name>.pdf`
- **Email:** Use `gog gmail send` with PDF attachment
- **Channel:** Upload via Mattermost API (see TOOLS.md for file upload pattern)

## Project Structure

```
Denario/projects/<name>/
├── input_files/
│   ├── data_description.md   # Your input
│   ├── idea.md               # Generated
│   ├── methods.md            # Generated
│   ├── results.md            # Generated or manual
│   └── plots/                # Generated
└── paper/
    ├── *.tex                 # Generated LaTeX
    └── *.pdf                 # Compiled paper
```

## Cost Estimates

| Step | Approximate Cost |
|------|-----------------|
| Planning (idea) | ~$0.15 |
| Methods | ~$0.20 |
| Results (6-step execution) | ~$0.50-2.00 |
| Paper generation | ~$0.30-1.00 |
| **Full pipeline** | **~$1-4 per experiment** |

## Lessons from Prior Experiments

1. **Hardware matters** — `get_results()` executes real code. If your experiment needs specific hardware (GPU, Mac, etc.), either attach the right node via Tailscale or write results manually.
2. **Scope tightly** — Pick the narrowest, most concrete angle from source material. "Language overloading" worked better than "all agentic coding techniques."
3. **Copy source files** into the Denario project directory before running — the executor can't reliably resolve paths outside its working directory.
4. **Run steps individually** rather than chaining — easier to debug and intervene.
5. **Manual intervention is normal** — Denario gets you 70-80% of the way; expect to edit results and fix LaTeX.
