---
name: research-experiment
description: Run end-to-end scientific research experiments using Denario and HAL's toolchain. Trigger when the user wants to analyze a codebase/dataset, generate a research paper, run a scientific experiment, or produce an academic PDF. Covers topic selection, Denario pipeline (idea → methods → results → paper), Codex review, LaTeX compilation, and distribution.
---

# Research Experiment Workflow

Run scientific research experiments using Denario's multi-agent pipeline with HAL's infrastructure.

## Prerequisites

- Denario installed at `/home/debian/clawd/home/Workspace/Denario`
- API keys in `/home/debian/clawd/home/Workspace/Denario/.env`:
  - `OPENAI_API_KEY` — GPT-5.2 (orchestrator/engineer/critic)
  - `GEMINI_API_KEY` — Gemini 3.0 Pro (planner/proposals). **Must be AI Studio key, not Vertex.**
  - `ANTHROPIC_API_KEY` — Claude (optional)
  - `PERPLEXITY_API_KEY` — for citation insertion (optional)
- XeLaTeX: `sudo apt install texlive-xetex texlive-publishers texlive-science`
- Denario import takes ~22s cold start — this is normal, not a hang

## Modes

### Mode 1: Denario Pipeline (multi-agent debate)

Uses GPT-5.2 + Gemini 3.0 Pro in adversarial maker/hater loops.
Best for: structured research questions with clear methodology.

### Mode 2: Claude Direct (solo + critic)

Claude subagent runs experiments directly, writes LaTeX.
Spawn Codex (xhigh) as critic at key junctures.
Best for: benchmarks, landscape comparisons, empirical work.

**⚠️ NEVER present outputs from different modes as comparable.** If one mode fails partially, report it as failed — don't substitute data from another source.

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
den.get_idea()    # ~10-20s, adversarial refinement (4 maker/hater rounds)
den.get_method()  # ~10-15s, generates methodology
den.get_results() # ⚠️ Tries to EXECUTE experiments — needs working API keys
den.get_paper(journal=Journal.APS)
```

Run in background sessions — each step can take 2-15 minutes.

### 4. Pipeline Integrity Rules

**CRITICAL — read before running:**

1. **If any pipeline step fails, the experiment is INCOMPLETE.** Report it as such. Never:
   - Manually copy results from another experiment into `results.md`
   - Present a paper with substituted data as a "Denario paper"
   - Compare a partially-failed pipeline's output with a fully-successful one
2. **If `get_results()` fails:** Fix the root cause (credentials, hardware, deps) and re-run. Do NOT work around it.
3. **If comparing two approaches (e.g., Denario vs Claude):** Both must produce results independently. If one fails, say "X failed, re-running" — don't present garbage.

### 5. Claude Direct Mode (with Critic)

For benchmarks and empirical work, skip Denario and run directly:

```
1. Claude subagent writes benchmark script
2. Runs all experiments, collects real numbers
3. → CHECKPOINT: Spawn Codex (xhigh) as critic
   - "Review this methodology. What's wrong? What's missing?"
   - Incorporate feedback
4. Claude writes LaTeX paper
5. → CHECKPOINT: Spawn Codex (xhigh) as reviewer
   - "Review this paper for weaknesses, overclaims, missing caveats"
   - Incorporate feedback
6. Compile + distribute
```

Critic junctures prevent single-perspective blind spots.

### 6. Known Issues & Workarounds

| Issue                                                   | Workaround                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------------------- |
| `get_results()` fails with Google Cloud auth            | Use `GEMINI_API_KEY` (AI Studio), not Vertex. Check `.env` has the alias. |
| `get_results()` needs specific hardware (GPU, M4, etc.) | ❌ Don't fake results. Either fix hardware access or report as blocked.   |
| `python` not found (only `python3`)                     | `sudo ln -s /usr/bin/python3 /usr/local/bin/python`                       |
| File path errors in cmbagent executor                   | Copy source files into Denario's project `input_files/` dir               |
| OOM on paper generation                                 | Run `get_paper()` separately after killing other processes                |
| Missing LaTeX packages                                  | `sudo apt install texlive-xetex texlive-publishers texlive-science`       |
| Missing `revtex4-2` class                               | `sudo apt install texlive-publishers`                                     |
| Perplexity citation API returns empty                   | Citations are optional — paper still valid without them                   |
| Import takes 22s                                        | Normal. Set subagent timeout to 2400s+                                    |

### 7. Manual Assembly Fallback

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

### 8. Review

Have Codex review the output:

```bash
codex -c model=gpt-5.2-codex exec "Review this abstract for weaknesses: ..."
```

Key review dimensions: clarity, methodology specificity, jargon definition, contribution type.

### 9. Distribution

- **CDN:** `sudo cp paper.pdf /var/www/cdn.phantastic.ai/<name>.pdf`
- **Wiki trace:** Create Phriction page at `/traces/<date>-<slug>/` linking all artifacts
- **Email:** Use `gog gmail send` with PDF attachment
- **Channel:** Upload via Mattermost API (see TOOLS.md for file upload pattern)

## Project Structure

```
Denario/projects/<name>/
├── input_files/
│   ├── data_description.md   # Your input
│   ├── idea.md               # Generated
│   ├── methods.md            # Generated
│   ├── results.md            # Generated (MUST be from this pipeline, not copied)
│   └── plots/                # Generated
└── paper/
    ├── *.tex                 # Generated LaTeX
    └── *.pdf                 # Compiled paper
```

## Cost Estimates

| Step                       | Approximate Cost         |
| -------------------------- | ------------------------ |
| Planning (idea)            | ~$0.15                   |
| Methods                    | ~$0.20                   |
| Results (6-step execution) | ~$0.50-2.00              |
| Paper generation           | ~$0.30-1.00              |
| **Full pipeline**          | **~$1-4 per experiment** |

## Lessons from Prior Experiments

1. **Intellectual honesty over completeness** — A failed experiment honestly reported is more valuable than a franken-paper with substituted data. (Incident: 2026-01-28-apples-to-oranges)
2. **Hardware matters** — `get_results()` executes real code. If your experiment needs specific hardware, either attach the right node or report as blocked.
3. **Scope tightly** — Pick the narrowest, most concrete angle from source material.
4. **Copy source files** into the Denario project directory before running — the executor can't reliably resolve paths outside its working directory.
5. **Run steps individually** rather than chaining — easier to debug and intervene.
6. **Manual intervention is normal** — Denario gets you 70-80% of the way; expect to edit results and fix LaTeX.
7. **Always create a Phorge ticket** before starting an experiment — traceability matters.
8. **Import cold start is 22s** — don't panic, don't set tight timeouts.
