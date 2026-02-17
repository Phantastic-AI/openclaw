import { describe, expect, it, vi } from "vitest";
import type { MattermostClient } from "./client.js";
import { createToolActivityTracker, createEditInPlaceTracker } from "./tool-activity.js";

function createMockClient() {
  const posts: Array<{ id: string; message: string; deleted?: boolean }> = [];
  let nextId = 1;

  const client = {
    baseUrl: "https://example.com",
    apiBaseUrl: "https://example.com/api/v4",
    token: "test-token",
    request: vi.fn(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (method === "POST" && path === "/posts") {
        const body = JSON.parse(init?.body as string);
        const post = { id: `post-${nextId++}`, message: body.message };
        posts.push(post);
        return post;
      }
      if (method === "PUT" && path.startsWith("/posts/")) {
        const body = JSON.parse(init?.body as string);
        const post = posts.find((p) => p.id === body.id);
        if (post) post.message = body.message;
        return post ?? { id: body.id, message: body.message };
      }
      if (method === "DELETE" && path.startsWith("/posts/")) {
        const postId = path.split("/posts/")[1];
        const post = posts.find((p) => p.id === postId);
        if (post) post.deleted = true;
        return {};
      }
      return {};
    }),
  } as unknown as MattermostClient;

  return { client, posts };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

describe("createToolActivityTracker", () => {
  it("creates a status post on first tool activity", async () => {
    const { client, posts } = createMockClient();
    const tracker = createToolActivityTracker({
      client,
      channelId: "ch-1",
      mode: "transient",
    });

    tracker.onActivity("tc-1", "🛠️ Exec: ls");
    await tick();
    await tracker.onComplete();

    expect(posts.length).toBe(1);
  });

  it("deletes post in transient mode on complete", async () => {
    const { client, posts } = createMockClient();
    const tracker = createToolActivityTracker({
      client,
      channelId: "ch-1",
      mode: "transient",
    });

    tracker.onActivity("tc-1", "🛠️ Exec: ls");
    await tick();
    await tracker.onComplete();

    expect(posts.length).toBe(1);
    expect(posts[0].deleted).toBe(true);
  });

  it("keeps post with done message in persist mode", async () => {
    const { client, posts } = createMockClient();
    const tracker = createToolActivityTracker({
      client,
      channelId: "ch-1",
      mode: "persist",
    });

    tracker.onActivity("tc-1", "🛠️ Exec: ls");
    await tick();
    tracker.onEnd("tc-1");
    await tick();
    await tracker.onComplete();

    expect(posts.length).toBe(1);
    expect(posts[0].deleted).toBeUndefined();
    expect(posts[0].message).toBe("✅ Done");
  });

  it("shows multiple active tools", async () => {
    const { client, posts } = createMockClient();
    const tracker = createToolActivityTracker({
      client,
      channelId: "ch-1",
      mode: "persist",
    });

    tracker.onActivity("tc-1", "🛠️ Exec: ls");
    await tick();
    tracker.onActivity("tc-2", "📖 Read: foo.ts");
    await tick();

    // Post should contain both tools
    expect(posts[0].message).toContain("🛠️ Exec: ls");
    expect(posts[0].message).toContain("📖 Read: foo.ts");

    await tracker.onComplete();
  });

  it("does not create post if no tools fire", async () => {
    const { client, posts } = createMockClient();
    const tracker = createToolActivityTracker({
      client,
      channelId: "ch-1",
      mode: "transient",
    });

    await tracker.onComplete();
    expect(posts.length).toBe(0);
  });
});

describe("createEditInPlaceTracker", () => {
  it("creates a status post on first tool activity (single mode)", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "single",
    });

    tracker.onActivity("tc-1", "🔍 Search: foo");
    await tick();

    expect(posts.length).toBe(1);
    expect(posts[0].message).toBe("🔍 Search: foo");

    await tracker.onComplete();
  });

  it("single mode replaces content with latest active tool", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "single",
    });

    tracker.onActivity("tc-1", "🔍 Search: foo");
    await tick();
    tracker.onEnd("tc-1");
    tracker.onActivity("tc-2", "📖 Read: bar.ts");
    await tick();

    expect(posts[0].message).toBe("📖 Read: bar.ts");

    await tracker.onComplete();
  });

  it("list mode shows completed lines with strikethrough", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "list",
    });

    tracker.onActivity("tc-1", "🔍 Search: foo");
    await tick();
    tracker.onEnd("tc-1");
    tracker.onActivity("tc-2", "📖 Read: bar.ts");
    await tick();

    expect(posts[0].message).toBe("~~🔍 Search: foo~~\n📖 Read: bar.ts");

    await tracker.onComplete();
  });

  it("list mode accumulates multiple completed lines", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "list",
    });

    tracker.onActivity("tc-1", "🔍 Search: foo");
    await tick();
    tracker.onEnd("tc-1");
    await tick();
    tracker.onActivity("tc-2", "📖 Read: bar.ts");
    await tick();
    tracker.onEnd("tc-2");
    await tick();
    tracker.onActivity("tc-3", "✏️ Edit: baz.ts");
    await tick();

    expect(posts[0].message).toBe("~~🔍 Search: foo~~\n~~📖 Read: bar.ts~~\n✏️ Edit: baz.ts");

    await tracker.onComplete();
  });

  it("deletes post on complete", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "single",
    });

    tracker.onActivity("tc-1", "🔍 Search: foo");
    await tick();
    await tracker.onComplete();

    expect(posts[0].deleted).toBe(true);
  });

  it("editFinalReply claims the status post and prevents deletion on complete", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "single",
    });

    tracker.onActivity("tc-1", "🔍 Search: foo");
    await tick();

    if (!tracker.editFinalReply) {
      throw new Error("editFinalReply missing on edit-in-place tracker");
    }
    const claimed = await tracker.editFinalReply("Final reply");
    expect(claimed).toBe(true);
    expect(posts[0].message).toBe("Final reply");

    await tracker.onComplete();
    expect(posts[0].deleted).toBeUndefined();
  });

  it("editFinalReply freezes the post against further tool updates (claimed)", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "list",
    });

    tracker.onActivity("tc-1", "🔍 Search: foo");
    await tick();

    if (!tracker.editFinalReply) {
      throw new Error("editFinalReply missing on edit-in-place tracker");
    }
    const claimed = await tracker.editFinalReply("Final reply");
    expect(claimed).toBe(true);

    tracker.onActivity("tc-2", "📖 Read: bar.ts");
    await tick();
    expect(posts[0].message).toBe("Final reply");

    tracker.onEnd("tc-2");
    await tick();
    expect(posts[0].message).toBe("Final reply");
  });

  it("does not create post if no tools fire", async () => {
    const { client, posts } = createMockClient();
    const tracker = createEditInPlaceTracker({
      client,
      channelId: "ch-1",
      display: "list",
    });

    await tracker.onComplete();
    expect(posts.length).toBe(0);
  });
});
