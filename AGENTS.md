# AGENTS.md

Instructions for AI coding agents (Codex, Claude Code, etc.) working on this VPS.

## Current Task

**[T307](https://hub.phantastic.ai/T307)** — Show tool use activity in Mattermost typing indicator

Replace generic "HAL is typing..." with tool-aware status messages (e.g. "🔍 Searching Phorge...", "⚡ Running exec...").

### Key Files

- Typing indicator docs: `docs/concepts/typing-indicators.md`
- Typing modes: never | instant | thinking | message — need to add tool-aware mode
- Mattermost channel plugin: look in `packages/` or channel layer for Mattermost typing implementation
- Agent loop / tool dispatch: where tool_call names are available to surface

---

## VPS Environment

| What                     | Path                                           |
| ------------------------ | ---------------------------------------------- |
| **Workspace root**       | `/home/debian/clawd/`                          |
| **Project repos**        | `/home/debian/clawd/home/Workspace/`           |
| **Phorge skill**         | `/home/debian/clawd/skills/phorge/`            |
| **Socratic tutor skill** | `/home/debian/clawdbot/skills/socratic-tutor/` |

---

## Task Management: Phorge

Use **Phorge** (not local `.agents/` or beads) for task tracking.

### CLI (local conduit)

```bash
# Search task
# (Replace <TASK_ID> with the task ID.)
printf '{"constraints":{"ids":[<TASK_ID>]},"limit":1}' \
  | sudo /srv/phorge/phorge/bin/conduit call --local --method maniphest.search --as admin --input -

# Create task
mkdir -p /home/debian/clawd/home/tmp
cat > /home/debian/clawd/home/tmp/task.json <<'JSON'
{"title":"My task","description":"Details here","priority":80}
JSON
sudo /srv/phorge/phorge/bin/conduit call --local --method maniphest.createtask --as admin --input /home/debian/clawd/home/tmp/task.json

# Edit task (e.g., close it)
cat > /home/debian/clawd/home/tmp/edit.json <<'JSON'
{"objectIdentifier":"<TASK_ID>","transactions":[{"type":"status","value":"resolved"}]}
JSON
sudo /srv/phorge/phorge/bin/conduit call --local --method maniphest.edit --as admin --input /home/debian/clawd/home/tmp/edit.json
```

### Wiki (Phriction)

```bash
# Search wiki (note: no leading slash in path)
printf '{"constraints":{"ancestorPaths":["people/"]},"limit":5}' \
  | sudo /srv/phorge/phorge/bin/conduit call --local --method phriction.document.search --as admin --input -

# Create wiki page (parent must exist)
mkdir -p /home/debian/clawd/home/tmp
cat > /home/debian/clawd/home/tmp/wiki.json <<'JSON'
{"slug":"hal/my-page","title":"My Page","content":"Content here"}
JSON
sudo /srv/phorge/phorge/bin/conduit call --local --method phriction.create --as admin --input /home/debian/clawd/home/tmp/wiki.json

# Edit wiki page
cat > /home/debian/clawd/home/tmp/wiki_edit.json <<'JSON'
{"slug":"hal/my-page","content":"Updated content","description":"Edit summary"}
JSON
sudo /srv/phorge/phorge/bin/conduit call --local --method phriction.edit --as admin --input /home/debian/clawd/home/tmp/wiki_edit.json
```

### Web UI

- Tasks: https://hub.phantastic.ai/maniphest/
- Wiki: https://hub.phantastic.ai/w/

### Linking

- Tasks: `[T<TASK_ID>](https://hub.phantastic.ai/T<TASK_ID>)`
- Wiki: `[hal/page](https://hub.phantastic.ai/w/hal/page/)`

---

## Oracle: Consulting Other AI Models

When stuck, need a second opinion, or reviewing complex code.

### GPT-5.2-Pro (browser, fixed port)

```bash
npx -y @steipete/oracle --engine browser --remote-chrome 127.0.0.1:9223 --model gpt-5.2-pro -p "your prompt"
```

With files:

```bash
npx -y @steipete/oracle --engine browser --remote-chrome 127.0.0.1:9223 --model gpt-5.2-pro \
  --file /path/to/file.py \
  -p "Review this code"
```

**If browser not running yet (one-time setup, let the user know to forward port 5900 via ssh and open localhost VNC):**

```bash
npx -y @steipete/oracle --engine browser --browser-manual-login --browser-keep-browser --browser-port 9223 -p "hello"
# Login, keep window open. All subsequent calls use --remote-chrome 127.0.0.1:9223
```

### Gemini 3 Pro (API, fast, huge context)

```bash
npx -y @steipete/oracle --model gemini-3-pro --file <files> -p "your prompt"
```

**Tips:**

- Use `gemini-3-pro` NOT `gemini-2.5-pro`
- GPT-5.2-Pro requires `--engine browser` + `--remote-chrome`

---

## Cass: Agent History + Context

Use `cass` to inspect prior coding-agent sessions, recover context quickly, and avoid repeating work.

### Health checks

```bash
cass health
cass status
cass stats
```

### Search and inspect

```bash
# Search past sessions/messages
cass search "maniphest.edit subtasks.add" --limit 20
cass search "docker compose restart frontend backend" --today

# Inspect a specific file from search results
cass view /path/to/source-file -n 120 -C 8

# Find related sessions for a source file
cass context /path/to/source-file --limit 8
```

### Machine-readable mode

```bash
cass status --json
cass search "your query" --json --limit 10
```

---

## Workflow

1. **Check for existing Phorge ticket** before starting work
2. **Create exec plan** for substantial work:
   - Template: `.agents/template/PLAN.md` (from template profile)
   - Save as `.agents/plans/<task-id>/PLAN.md`
   - Update progress in the plan as you work
3. **Commit incrementally** with `T<id>` in commit messages
4. **Update ticket** when done (status → resolved)
5. **Upload exec plan** either to ticket, parent ticket or matching doc in Phriction - dependent on task and strictness

---

## Rules

1. **Never delete files** without explicit human permission
2. **No destructive git commands** (`reset --hard`, `clean -fd`, `rm -rf`) without approval
3. **Test before declaring done** — run the code, verify it works

---

## Communication Style

- Be blunt + decisive. Lead with the answer.
- Avoid hedging: "maybe", "might", "could", "likely"
- If unsure, say "I don't know" + the fastest way to verify.
- Keep replies terse (<10 lines unless asked for more).
