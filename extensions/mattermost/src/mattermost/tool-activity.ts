import type { MattermostClient } from "./client.js";
import { createMattermostPost, deleteMattermostPost, updateMattermostPost } from "./client.js";

export type ToolActivityMode = "off" | "persist" | "transient";

export type EditInPlaceConfig = {
  mode: "editInPlace";
  display?: "single" | "list";
};

export type ToolActivityConfig = ToolActivityMode | EditInPlaceConfig;

export type ToolActivityTracker = {
  /** Called when a tool starts or updates — creates or updates the status post. */
  onActivity: (toolCallId: string, summary: string) => void;
  /** Called when a tool ends — removes it from active list, updates post. */
  onEnd: (toolCallId: string) => void;
  /** Called when the entire reply is complete — cleanup the status post. */
  onComplete: () => Promise<void>;
  /** Returns the current status post id (editInPlace only). */
  getStatusPostId?: () => string | undefined;
  /**
   * Edit the status post to become the final reply text, claiming the post
   * so that onComplete() becomes a no-op. Returns true if successful.
   * Only available on editInPlace trackers.
   */
  editFinalReply?: (text: string) => Promise<boolean>;
};

/**
 * Creates a tracker that maintains a single Mattermost "status post"
 * showing currently-active tool calls. The post is created on first
 * tool start and updated as tools change. On completion it is either
 * deleted (transient) or left (persist).
 */
export function createToolActivityTracker(params: {
  client: MattermostClient;
  channelId: string;
  rootId?: string;
  mode: ToolActivityMode;
}): ToolActivityTracker {
  const { client, channelId, rootId, mode } = params;

  // Map of toolCallId → summary text for currently-active tools.
  const activeTools = new Map<string, string>();
  let statusPostId: string | undefined;
  // Serialise post mutations to avoid race conditions.
  let pending: Promise<void> = Promise.resolve();
  let completed = false;

  function buildStatusMessage(): string {
    if (activeTools.size === 0) {
      return "✅ Done";
    }
    return [...activeTools.values()].join("\n");
  }

  function enqueue(fn: () => Promise<void>): void {
    pending = pending.then(fn).catch(() => {});
  }

  function syncPost(): void {
    if (completed) return;
    enqueue(async () => {
      if (completed) return;
      const message = buildStatusMessage();
      if (!statusPostId) {
        try {
          const post = await createMattermostPost(client, {
            channelId,
            message,
            rootId,
          });
          statusPostId = post.id;
        } catch {
          // Best-effort — don't crash the reply flow.
        }
      } else {
        try {
          await updateMattermostPost(client, {
            postId: statusPostId,
            message,
          });
        } catch {
          // Post may have been deleted externally; ignore.
        }
      }
    });
  }

  return {
    onActivity(toolCallId: string, summary: string) {
      activeTools.set(toolCallId, summary);
      syncPost();
    },

    onEnd(toolCallId: string) {
      activeTools.delete(toolCallId);
      syncPost();
    },

    async onComplete() {
      completed = true;
      await pending;
      if (!statusPostId) return;
      if (mode === "transient") {
        try {
          await deleteMattermostPost(client, statusPostId);
        } catch {
          // Best-effort cleanup.
        }
      } else if (mode === "persist") {
        try {
          await updateMattermostPost(client, {
            postId: statusPostId,
            message: "✅ Done",
          });
        } catch {
          // Ignore.
        }
      }
      statusPostId = undefined;
    },
  };
}

/**
 * Creates a tracker using edit-in-place behavior: a single post is created
 * on first tool activity, then edited as tools progress.
 *
 * Display modes:
 * - "single": The post always shows only the current active tool line.
 * - "list": The post accumulates all tool lines. Completed lines are
 *   shown with strikethrough (~~line~~), and the current line is active.
 *
 * On completion the post is deleted (the agent reply replaces it).
 */
export function createEditInPlaceTracker(params: {
  client: MattermostClient;
  channelId: string;
  rootId?: string;
  display: "single" | "list";
}): ToolActivityTracker {
  const { client, channelId, rootId, display } = params;

  // Active tools: toolCallId → summary
  const activeTools = new Map<string, string>();
  // For "list" mode: ordered history of completed tool summaries.
  const completedLines: string[] = [];

  let statusPostId: string | undefined;
  let pending: Promise<void> = Promise.resolve();
  let completed = false;

  // When true, tool activity should stop mutating the status post.
  // - During editFinalReply: prevents new enqueues while we wait for `pending`.
  // - After a successful editFinalReply: `claimed` stays true to freeze the post permanently.
  let finalizing = false;

  function buildMessage(): string {
    if (display === "single") {
      // Show only the most recent active tool, or a "done" marker.
      const values = [...activeTools.values()];
      return values.length > 0 ? values[values.length - 1] : "✅ Done";
    }
    // "list" mode: completed lines in strikethrough, then active lines.
    const lines: string[] = [];
    for (const line of completedLines) {
      lines.push(`~~${line}~~`);
    }
    for (const line of activeTools.values()) {
      lines.push(line);
    }
    return lines.length > 0 ? lines.join("\n") : "✅ Done";
  }

  function enqueue(fn: () => Promise<void>): void {
    pending = pending.then(fn).catch(() => {});
  }

  function syncPost(): void {
    if (completed || finalizing || claimed) return;
    enqueue(async () => {
      if (completed) return;
      const message = buildMessage();
      if (!statusPostId) {
        try {
          const post = await createMattermostPost(client, {
            channelId,
            message,
            rootId,
          });
          statusPostId = post.id;
        } catch {
          // Best-effort.
        }
      } else {
        try {
          await updateMattermostPost(client, {
            postId: statusPostId,
            message,
          });
        } catch {
          // Post may have been deleted externally; ignore.
        }
      }
    });
  }

  // When true, the status post has been claimed by editFinalReply
  // and onComplete should not touch it.
  let claimed = false;

  return {
    onActivity(toolCallId: string, summary: string) {
      if (completed || finalizing || claimed) return;
      activeTools.set(toolCallId, summary);
      syncPost();
    },

    onEnd(toolCallId: string) {
      if (completed || finalizing || claimed) return;
      const summary = activeTools.get(toolCallId);
      activeTools.delete(toolCallId);
      if (display === "list" && summary) {
        completedLines.push(summary);
      }
      syncPost();
    },

    async onComplete() {
      completed = true;
      await pending;
      if (!statusPostId || claimed) return;
      // Fallback: delete if not claimed by editFinalReply.
      try {
        await deleteMattermostPost(client, statusPostId);
      } catch {
        // Best-effort cleanup.
      }
      statusPostId = undefined;
    },

    getStatusPostId() {
      return statusPostId;
    },

    async editFinalReply(text: string): Promise<boolean> {
      try {
        finalizing = true;
        // Wait for any pending post creates/updates to finish. While finalizing,
        // onActivity/onEnd will not enqueue additional edits.
        await pending;
        if (!statusPostId) {
          const post = await createMattermostPost(client, {
            channelId,
            message: text,
            rootId,
          });
          statusPostId = post.id;
        } else {
          await updateMattermostPost(client, {
            postId: statusPostId,
            message: text,
          });
        }
        claimed = true;
        return true;
      } catch {
        return false;
      } finally {
        finalizing = false;
      }
    },
  };
}
