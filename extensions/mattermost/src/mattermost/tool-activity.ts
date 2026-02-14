import type { MattermostClient } from "./client.js";
import { createMattermostPost, deleteMattermostPost, updateMattermostPost } from "./client.js";

export type ToolActivityMode = "off" | "persist" | "transient";

export type ToolActivityTracker = {
  /** Called when a tool starts or updates — creates or updates the status post. */
  onActivity: (toolCallId: string, summary: string) => void;
  /** Called when a tool ends — removes it from active list, updates post. */
  onEnd: (toolCallId: string) => void;
  /** Called when the entire reply is complete — cleanup the status post. */
  onComplete: () => Promise<void>;
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
