# T307: Show Tool Use Activity in Mattermost Typing Indicator

_A living design & execution record._

---

## Metadata

- **Owner:** HAL (coding agent)
- **Created:** 2026-02-14
- **Last Updated:** 2026-02-14
- **Agent / Module:** `extensions/mattermost/` + `src/auto-reply/`
- **Related Plans:** [T308](https://hub.phantastic.ai/T308) (agent-tool CLI — will trigger `openclaw system event` on completion, should benefit from tool visibility)
- **Phorge:** [T307](https://hub.phantastic.ai/T307)

---

## Replace generic "HAL is typing..." with tool-aware status messages

**Goal:** When HAL executes tools during a reply, Mattermost shows contextual activity —
e.g. "📖 Read: src/foo.ts", "🛠️ Exec: git status", "🧠 Memory Search: project config" —
via a real-time status post that updates as tools start/end.

**Done looks like:** During a multi-tool reply, the channel shows an auto-updating status
post with current tool summaries. On completion it either vanishes (`transient`) or shows
"Done" (`persist`). Config: `toolActivity: "off" | "transient" | "persist"`.

---

## Purpose / Big Picture

Users watching HAL in Mattermost see "HAL is typing..." for potentially minutes during
tool-heavy runs (coding tasks, research, exec commands). No feedback on _what_ is happening.

T307 surfaces tool activity in real-time:

- Reduces user anxiety during long operations.
- Provides transparency ("it's reading my code, not stuck").
- Enables monitoring tool usage patterns.
- Works with the agent-tool ecosystem (T308) — when `agent-tool` dispatches coding agents
  that trigger HAL replies, the user sees tool activity from those sub-sessions too.

---

## Context and Orientation

### Mattermost API constraint

The typing endpoint `POST /users/me/typing` accepts **only** `channel_id` + `parent_id`.
No custom text parameter. "username is typing..." cannot be customized. Confirmed via
API docs and [GitHub issue #12609](https://github.com/mattermost/mattermost/issues/12609).

**Approach:** Use status posts (create/update/delete a real Mattermost post) for tool
visibility. This is per-channel, per-thread, and supports arbitrary text/markdown.

### What already exists on `feat/tool-activity-visibility`

The feature is **~90% implemented**. The full pipeline:

```
Agent loop (tool event)
  → resolveToolDisplay() + formatToolSummary()
    → ToolActivityEvent { phase, toolName, toolCallId, summary }
      → onToolActivity callback
        → createToolActivityTracker (Mattermost status post)
```

| Layer               | File                                                      | Status                               |
| ------------------- | --------------------------------------------------------- | ------------------------------------ |
| Event type          | `src/auto-reply/types.ts:10-18`                           | Done                                 |
| Callback wiring     | `src/auto-reply/reply/agent-runner-execution.ts:342-376`  | Done                                 |
| Tool display        | `src/agents/tool-display.ts` + `.json`                    | Done (all tools mapped)              |
| Mattermost tracker  | `extensions/mattermost/src/mattermost/tool-activity.ts`   | Done                                 |
| Monitor integration | `extensions/mattermost/src/mattermost/monitor.ts:867-910` | Done                                 |
| Config schema       | `src/config/zod-schema.agent-defaults.ts:130-132`         | Done                                 |
| Typing controller   | `src/auto-reply/reply/typing.ts`                          | Done (independent, coexists)         |
| Typing signaler     | `src/auto-reply/reply/typing-mode.ts`                     | Done (signalToolStart refreshes TTL) |

### Key integration point: `onToolActivity` callback

In `agent-runner-execution.ts:342-376`, the `onAgentEvent` handler fires on every tool
stream event. When `phase` is `start`, `update`, or `end`:

1. Extracts `toolName` and `toolCallId` from the event
2. On `start`: extracts `args` and calls `resolveToolDisplay({ name, args })` to get
   emoji/title/detail (e.g. `{ emoji: "🛠️", label: "Exec", detail: "git status" }`)
3. Calls `formatToolSummary(display)` → `"🛠️ Exec: git status"`
4. Fires `params.opts.onToolActivity(event)` with the summary

The Mattermost monitor (`monitor.ts:895-905`) maps this to the tracker:

- `start`/`update` → `tracker.onActivity(toolCallId, summary)` — creates/updates post
- `end` → `tracker.onEnd(toolCallId)` — removes from active set, updates post
- After reply dispatch: `tracker.onComplete()` — deletes post (transient) or marks done (persist)

### Relationship with agent-tool (T308)

T308 builds a unified CLI (`agent-tool`) that dispatches coding agents (Codex, Claude Code).
When agent-tool triggers a reply through HAL, the tool activity pipeline fires normally —
agent-tool doesn't need special integration. The `onToolActivity` callback is channel-agnostic;
any channel extension that passes `onToolActivity` in `replyOptions` gets tool visibility.

Future: agent-tool could fire its own `openclaw system event` on completion, which triggers
a heartbeat/gateway message — orthogonal to T307's real-time tool activity.

---

## Plan of Work

### Phase 1: Verify & test existing implementation

#### Step 1: Run existing unit tests

```bash
cd /home/debian/openclaw-upgrades/releases/20260212T013813Z_origin_main_
npx vitest run src/agents/tool-display.test.ts
```

- **Expected:** All 11 tests pass (formatting, edge cases, truncation).
- **Validation:** Green test output.

#### Step 2: Add unit tests for `createToolActivityTracker`

Create `extensions/mattermost/src/mattermost/tool-activity.test.ts`:

```typescript
// Mock MattermostClient, test:
// 1. onActivity(id, summary) → createMattermostPost on first call
// 2. onActivity(id, summary) again → updateMattermostPost
// 3. onActivity(id2, summary2) → updateMattermostPost (two active tools, newline-joined)
// 4. onEnd(id) → updateMattermostPost (one tool removed)
// 5. onEnd(id2) → updateMattermostPost (shows "✅ Done" or empty)
// 6. onComplete() mode="transient" → deleteMattermostPost
// 7. onComplete() mode="persist" → updateMattermostPost with "✅ Done"
// 8. onComplete() with no prior activity → no-op (no post created)
// 9. Concurrent onActivity calls serialize (no race on post creation)
// 10. Post creation failure → silent (best-effort)
```

Run:

```bash
npx vitest run extensions/mattermost/src/mattermost/tool-activity.test.ts
```

- **Expected:** All pass.
- **Idempotence:** Test file is new, safe to create. No existing file to clobber.

#### Step 3: End-to-end smoke test

1. Set `toolActivity: "transient"` in the running deployment config.
2. Trigger a reply that uses tools (e.g. "read AGENTS.md").
3. Observe Mattermost: status post appears with "📖 Read: AGENTS.md", then vanishes.
4. Set `toolActivity: "persist"`, repeat — post should show "✅ Done" at end.
5. Set `toolActivity: "off"` — no status post.

### Phase 2: Polish (if needed after testing)

#### Step 4: (Optional) Debounce rapid tool updates

If smoke test reveals flicker or rate-limit issues from rapid tool starts/ends:

In `tool-activity.ts`, add a 300ms debounce to `syncPost()`:

```typescript
let debounceTimer: NodeJS.Timeout | undefined;

function syncPost(): void {
  if (completed) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    enqueue(async () => {
      /* existing create/update logic */
    });
  }, 300);
}
```

- **Validation:** Re-run smoke test; observe fewer API calls in network logs.
- **Rollback:** Remove debounce timer, revert to direct enqueue.

#### Step 5: (Optional) Improve multi-tool formatting

If multiple tools run concurrently and the newline-joined format looks cluttered:

```typescript
function buildStatusMessage(): string {
  if (activeTools.size === 0) return "✅ Done";
  const lines = [...activeTools.values()];
  if (lines.length === 1) return lines[0];
  return lines.map((line) => `- ${line}`).join("\n");
}
```

### Phase 3: Documentation

#### Step 6: Update `docs/concepts/typing-indicators.md`

Add a "Tool Activity" section:

````markdown
## Tool activity posts

When `agents.defaults.toolActivity` is set, OpenClaw creates a Mattermost post showing
which tools are currently executing. The post updates in real-time and is removed (or
marked done) when the reply completes.

### Modes

- `off` — no tool activity posts (default).
- `transient` — create a status post during tool execution, delete when done.
- `persist` — create a status post, update to "✅ Done" when complete (kept in history).

### Configuration

```json5
{
  agent: {
    toolActivity: "transient",
  },
}
```
````

### How it works

Tool activity posts are independent of typing indicators. The typing indicator shows
"HAL is typing..." while the status post shows specific tool details like
"🛠️ Exec: git status" or "📖 Read: src/config.ts".

```

---

## Progress

- [x] (2026-02-14) Investigation complete — mapped all code paths.
- [x] (2026-02-14) Confirmed feature is ~90% implemented on branch.
- [x] (2026-02-14) Confirmed Mattermost typing API has no custom text.
- [x] (2026-02-14) Wrote execution plan.
- [ ] Step 1: Run existing tool-display tests.
- [ ] Step 2: Write unit tests for tool-activity tracker.
- [ ] Step 3: End-to-end smoke test on live deployment.
- [ ] Step 4: (Optional) Debounce rapid updates if needed.
- [ ] Step 5: (Optional) Improve multi-tool formatting.
- [ ] Step 6: Update docs.
- [ ] Mark T307 resolved in Phorge.

---

## Surprises & Discoveries

- **Feature is mostly done.** The `feat/tool-activity-visibility` branch has the full
  pipeline implemented. Remaining work is testing, documentation, and minor polish.

- **Mattermost typing API is a dead end.** `POST /users/me/typing` has no custom text.
  Status posts are the right (and already implemented) approach.

- **Channel-agnostic design.** The `onToolActivity` callback in `GetReplyOptions`
  (`src/auto-reply/types.ts:41`) means any channel extension (not just Mattermost) can
  implement tool visibility by passing a callback. Discord, WhatsApp, etc. could add
  their own trackers.

- **agent-tool (T308) integration is free.** Since tool activity fires from the agent
  loop regardless of what triggered the reply, agent-tool dispatched sessions get tool
  visibility automatically.

---

## Decision Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Use status posts, not typing API text | Mattermost typing API has no custom text param. Status posts support arbitrary markdown, are per-channel, and are already implemented. | 2026-02-14 |
| Let typing indicator and status post coexist | Different purposes: typing = "I'm working", post = "here's what". Typing auto-expires after ~6s. No visual conflict. | 2026-02-14 |
| Skip custom user status (`PUT /users/me/status/custom`) | Global (not per-channel), heavy API call, needs cleanup. Status posts are superior for this use case. | 2026-02-14 |
| Default `toolActivity` to `"off"` | Avoids surprise API calls. Users opt-in. Could revisit default after validation. | 2026-02-14 |

---

## Risks / Open Questions

1. **Rate limiting** — Rapid tool starts/ends (20+ reads in succession) could hit Mattermost
   rate limits. The serial queue mitigates but doesn't debounce. Step 4 addresses this.

2. **Default mode** — Should `toolActivity` default to `"transient"` for better out-of-box
   experience? Needs product decision. Currently `"off"`.

3. **Status post threading** — Post appears in the conversation timeline. If it appears
   between reply chunks it looks odd. Currently uses `rootId` for threading, which should
   keep it in the thread. Verify in smoke test.

4. **Sub-agent tool activity** — When `sessions_spawn` creates a sub-agent, does its tool
   activity propagate to the parent's tracker? Currently no — each session has its own
   `onToolActivity`. This is acceptable: the parent session shows its own tools, including
   the `sessions_spawn` tool itself (`🧑‍🔧 Sub-agent: task...`).

---

## Next Steps / Handoff Notes

1. Get plan approval.
2. Execute Phase 1 (test, verify).
3. Execute Phase 2 (polish) if needed.
4. Execute Phase 3 (docs).
5. Resolve T307 in Phorge.
```
