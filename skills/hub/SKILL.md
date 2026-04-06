---
name: hub
description: MoltPod Hub — task management, wiki docs, projects. Use hub CLI or HTTP API for all workspace operations. Use when creating tasks, updating status, writing wiki pages, adding comments, or tracking work.
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["hub"] },
      },
  }
---

# MoltPod Hub

Hub is your workspace for task management, wiki documentation, and project tracking.

## Quick Reference

- **CLI:** `hub` (on PATH)
- **API:** `http://localhost:3001`
- **Actor:** Use `openclaw` as your identity
- **Vault:** Auto-configured via `HUB_VAULT` env var

## Task Management

```bash
hub task list                                    # list open tasks
hub task list --project INFRA                    # filter by project
hub task list --assignee openclaw                # filter by assignee
hub task show <id>                               # show task with comments
hub task create "Title" --project INFRA --priority high --assignee openclaw
hub task create "Title" --description "Details" --project INFRA
hub task update <id> --status progress           # open|progress|review|blocked|resolved
hub task close <id>                              # shortcut for --status resolved
hub task assign <id> <username>
hub task comment <id> "Comment body"             # add a comment
hub task search "query string"
hub task block <id> --by <blocker-id>            # add dependency
hub task unblock <id> --from <blocker-id>        # remove dependency
hub task deps <id>                               # show dependency graph
hub task label <id> add "label-name"
hub task labels                                  # list all labels in use
```

## Wiki

```bash
hub wiki list                                    # list all pages
hub wiki show <path>                             # show page content
hub wiki create <path> "Title" --project INFRA   # create new page
hub wiki edit <path> --content "new markdown"     # edit page content
```

## Projects

```bash
hub project list
hub project show <key>                           # e.g. INFRA
hub project create "Name" --key KEY --icon server
hub project members <key>
```

## Users

```bash
hub user list
hub user show <username>
```

## Other Domains

```bash
hub board show <project-key>
hub status
hub person list|show|create|update|delete
hub event list|show|create|update|delete
hub campaign list|show|create|update|delete
hub gallery list|show|create|upload|update|delete
hub scan <subcommand>
```

## HTTP API

All operations at `http://localhost:3001/api/`:

```bash
# Tasks
GET    /api/tasks                                # list open
GET    /api/tasks?project=INFRA&status=resolved  # filter
GET    /api/tasks/<id>                           # show with comments
POST   /api/tasks                                # create (JSON: title, description, project, priority, assignee)
PATCH  /api/tasks/<id>                           # update (JSON: status, priority, assignee)
POST   /api/tasks/<id>/comments                  # add comment (JSON: body, author)

# Wiki
GET    /api/docs                                 # list all pages
GET    /api/docs/<path>                          # show page
POST   /api/docs                                 # create (JSON: path, title, content, project)
PATCH  /api/docs/<path>                          # edit (JSON: content)

# Projects / Users / Search
GET    /api/projects
GET    /api/users
GET    /api/search?q=<query>
```

## Luma Event Sync (API Reference)

Hub events can sync bidirectionally with Luma. See `LUMA_SYNC.md` in the Hub repo for full design.

**Base URL:** `https://public-api.luma.com/v1`
**Auth:** `x-luma-api-key: <key>` header (env var: `LUMA_API_KEY`)

Key endpoints:
- `GET /calendar/list-events` — list all calendar events
- `GET /event/get?event_id=<id>` — get single event
- `POST /event/create` — create event
- `PATCH /event/update` — update event fields
- `GET /event/get-guests?event_id=<id>` — list event guests
- `POST /event/cancel/request` + `POST /event/cancel` — two-step event deletion

⚠️ Do NOT use `api.lu.ma` — it 404s. The correct host is `public-api.luma.com`.

## Workflow Rules

1. **Use `openclaw` as actor** for all operations
2. **Task flow:** open -> progress -> review -> resolved (or blocked)
3. **Review gate:** Move to `review` before `resolved` -- a second agent reviews
4. **Always add completion notes** before closing: what changed, where, how to verify
5. **Create tickets** for bugs found while working

## Current State

- **Project:** INFRA (infrastructure ops, hardening, incidents)
- **Users:** aditya (human), claude (agent), openclaw (agent)
- **Hub URL:** http://discovery-two:3001

## Priority Values

| Value | Display |
|-------|---------|
| low | Low |
| normal | Normal |
| high | High |

## Status Values

| Status | Display |
|--------|---------|
| open | Open |
| progress | In Progress |
| blocked | Blocked |
| review | Review |
| resolved | Done |
