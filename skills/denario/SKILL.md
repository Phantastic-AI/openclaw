---
name: denario
description: Scientific research assistant multi-agent system. Use for automated scientific research workflows including data analysis, research idea generation, methodology development, experimental results computation, and LaTeX paper generation. Trigger when user asks to analyze experimental data, generate research ideas, write scientific papers, or perform end-to-end scientific research automation.
---

# Denario

Denario is a multi-agent system for scientific research assistance. It uses AG2, LangGraph, and cmbagent to automate the full research workflow: from data description to published paper.

## Installation

Already installed at: `/home/debian/clawd/home/Workspace/Denario`

Activate the venv:
```bash
source /home/debian/clawd/home/Workspace/Denario/.venv/bin/activate
```

## Required API Keys

Set these environment variables before using Denario:

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | Primary LLM (GPT-4o, o3-mini, etc.) |
| `GOOGLE_API_KEY` | Recommended | Gemini models |
| `ANTHROPIC_API_KEY` | Optional | Claude models |
| `PERPLEXITY_API_KEY` | Optional | Citation search |
| `SEMANTIC_SCHOLAR_KEY` | Optional | Fast semantic scholar lookups |

Create a `.env` file or export these variables before running Denario.

## Usage

### Python API

```python
from denario import Denario, Journal

# Initialize with project directory
den = Denario(project_dir="my_research_project")

# 1. Describe your data and tools
prompt = """
Analyze the experimental data stored in data.csv using sklearn and pandas.
This data includes time-series measurements from a particle detector.
"""
den.set_data_description(prompt)

# 2. Generate research idea
den.get_idea()

# 3. Generate methodology
den.get_method()

# 4. Compute results and generate plots
den.get_results()

# 5. Generate LaTeX paper (APS, Nature, Science styles available)
den.get_paper(journal=Journal.APS)
```

### Manual Input

Override any step with your own content:
```python
den.set_idea("path/to/my_idea.md")
den.set_method("path/to/my_method.md")
den.set_results("path/to/my_results.md")
```

### GUI Mode

Launch the Streamlit GUI:
```bash
cd /home/debian/clawd/home/Workspace/Denario
source .venv/bin/activate
denario run
```

## Journal Styles

Available journal formats for paper generation:
- `Journal.APS` - Physical Review Journals
- `Journal.NATURE` - Nature
- `Journal.SCIENCE` - Science

## Project Structure

Each project creates this structure:
```
project_dir/
├── input_files/
│   ├── data_description.md
│   ├── idea.md
│   ├── methods.md
│   ├── results.md
│   └── plots/
└── paper/
    └── (generated LaTeX files)
```

## Wrapper Script

For CLI usage, run this wrapper:

```bash
#!/bin/bash
cd /home/debian/clawd/home/Workspace/Denario
source .venv/bin/activate
python -c "
from denario import Denario, Journal
import sys

den = Denario(project_dir='$1')
den.set_data_description('''$2''')
den.get_idea()
den.get_method()
den.get_results()
den.get_paper(journal=Journal.APS)
print('Research complete. Check:', '$1')
"
```

## Supported Models

Denario supports these LLMs (set via `model` parameter):
- `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`
- `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `gpt-4.5`, `gpt-5`, `gpt-5-mini`
- `o3-mini`
- `claude-3.7-sonnet`, `claude-4-opus`, `claude-4.1-opus`
