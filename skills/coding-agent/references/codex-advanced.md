# Codex CLI Advanced Patterns

## Session Management

### Session Storage
Sessions stored in `~/.codex/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuid>.jsonl`

Each session is a JSONL file containing:
- `response_item` — model outputs, function calls
- `event_msg` — agent reasoning, token counts, rate limits
- `turn_context` — turn boundaries

### Resume Sessions

Resume interrupted or completed sessions to continue work:

```bash
# Resume with prompt (non-interactive, for background use)
codex exec resume <SESSION_ID> "Continue where you left off"

# Resume interactively (needs TTY)
codex resume --last  # most recent session
codex resume --all   # picker showing all sessions

# Example with full UUID from filename
codex exec resume 019c04e5-0a7a-7d73-a2c8-67c95124581b "Fix the remaining test failures"
```

### Session Forensics (Debugging Failures)

When a session fails or gets killed, read the rollout file to understand what happened:

```bash
# Find recent sessions
ls -lt ~/.codex/sessions/2026/01/28/ | head -5

# Extract reasoning blocks (what Codex was thinking)
cat ~/.codex/sessions/2026/01/28/rollout-*.jsonl | \
  jq -r 'select(.type=="event_msg" and .payload.type=="agent_reasoning") | .payload.text' | tail -10

# Extract last few function calls
cat ~/.codex/sessions/2026/01/28/rollout-*.jsonl | \
  jq -r 'select(.type=="response_item" and .payload.type=="function_call") | 
         "\(.payload.name): \(.payload.arguments | fromjson | .command | .[0:100])"' | tail -10

# Check token usage (last entry usually has totals)
tail -5 ~/.codex/sessions/2026/01/28/rollout-*.jsonl | jq '.payload.info.total_token_usage'
```

## Execution Modes

### Sandboxed Mode (`--full-auto`)
- Network access blocked
- Filesystem restricted to workspace
- Auto-approves file changes
- Good for: Pure code generation, safe experimentation

### YOLO Mode (`--dangerously-bypass-approvals-and-sandbox`)
- Full network access (API calls, web requests)
- Full filesystem access
- No approval prompts
- Good for: Tasks needing external APIs, installing packages, publishing

```bash
# Sandboxed (safe but limited)
codex exec --full-auto "Build a React component"

# YOLO (powerful but be careful)
codex exec --dangerously-bypass-approvals-and-sandbox "Deploy to production"
```

## Timeout Management

### From Clawdbot

When invoking Codex via `bash`, the `timeout` parameter kills the process after N seconds:

```bash
# 1 hour timeout
bash pty:true timeout:3600 command:"codex exec ..."

# 2 hour timeout for long tasks
bash pty:true timeout:7200 command:"codex exec ..."
```

**Rule of thumb:** Set timeout to expected duration + 50% buffer minimum.

### Codex Internal Timeouts

Codex shell commands have their own `timeout_ms` in the function call:

```json
{"command": "python script.py", "timeout_ms": 7200000}
```

If Codex sets a 2-hour internal timeout but your Clawdbot timeout is 1 hour, Clawdbot kills Codex first.

### Avoiding Premature Kills

1. Check expected duration before running
2. Set Clawdbot timeout > Codex's expected needs
3. If killed, check session logs to see what it was doing
4. Resume instead of restart when possible (preserves context)

## Model Configuration

Default model set in `~/.codex/config.toml`:

```toml
model = "gpt-5.2-codex"
model_reasoning_effort = "xhigh"
```

Override per-run:

```bash
codex exec -c model="o3" "Your prompt"
codex exec -c model_reasoning_effort="high" "Your prompt"
```

**Note:** Reasoning effort is a separate config, NOT part of model name.
- ✅ `model = "gpt-5.2-codex"` + `model_reasoning_effort = "xhigh"`
- ❌ `model = "gpt-5.2-codex-xhigh"` (invalid)

## Best Practices for Long Tasks

### Before Starting

1. **State the plan**: What will Codex do? How long should it take?
2. **Identify risks**: Network needed? Write access? External APIs?
3. **Choose mode**: Sandboxed if possible, YOLO if needed
4. **Set timeout**: Duration + 50% buffer

### During Execution

- Use `background:true` for tasks >5 minutes
- Monitor with `process action:log sessionId:XXX`
- Don't kill just because it's "slow" — check logs first

### After Failure

1. **Check session log** — what was it doing when it died?
2. **Identify cause** — timeout? error? resource limit?
3. **Resume if possible** — `codex exec resume <SESSION_ID> "Continue"`
4. **Fix root cause** — don't just retry blindly

## Common Patterns

### Research/Experiment Pipeline

```bash
# Set generous timeout for iterative work
bash pty:true workdir:~/project background:true timeout:7200 \
  command:"codex exec --dangerously-bypass-approvals-and-sandbox \
  'Run the experiment pipeline. If something fails, debug it and retry. 
   When done, summarize results.'"
```

### Code Review with Context

```bash
# Clone, checkout PR, review with full context
REVIEW_DIR=$(mktemp -d)
git clone <repo> $REVIEW_DIR
cd $REVIEW_DIR && gh pr checkout <PR#>
bash pty:true workdir:$REVIEW_DIR \
  command:"codex exec 'Review this PR. Check for bugs, style issues, and security.'"
```

### Batch Processing with Resume

```bash
# Start batch job
bash pty:true background:true timeout:3600 \
  command:"codex exec --full-auto 'Process all files in data/. Save results to output/'"

# If killed mid-way, find session and resume
SESSION=$(ls -t ~/.codex/sessions/2026/01/28/*.jsonl | head -1 | grep -oP '[0-9a-f-]{36}')
codex exec resume $SESSION "Continue processing remaining files"
```
