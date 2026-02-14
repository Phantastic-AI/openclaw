import { describe, expect, it } from "vitest";
import { formatToolSummary, resolveToolDisplay } from "./tool-display.js";

describe("formatToolSummary", () => {
  it("formats exec with command", () => {
    const display = resolveToolDisplay({ name: "exec", args: { command: "ls -la" } });
    const summary = formatToolSummary(display);
    expect(summary).toBe("🛠️ Exec: ls -la");
  });

  it("formats Read with file path", () => {
    const display = resolveToolDisplay({ name: "Read", args: { path: "src/foo.ts" } });
    const summary = formatToolSummary(display);
    expect(summary).toBe("📖 Read: src/foo.ts");
  });

  it("formats browser with action", () => {
    const display = resolveToolDisplay({ name: "browser", args: { action: "snapshot" } });
    const summary = formatToolSummary(display);
    expect(summary).toBe("🌐 Browser: snapshot");
  });

  it("formats memory_search with query", () => {
    const display = resolveToolDisplay({ name: "memory_search", args: { query: "test query" } });
    const summary = formatToolSummary(display);
    expect(summary).toBe("🧠 Memory Search: test query");
  });

  it("formats unknown tool with fallback emoji", () => {
    const display = resolveToolDisplay({ name: "custom_tool", args: {} });
    const summary = formatToolSummary(display);
    expect(summary).toBe("🧩 Custom Tool");
  });

  it("handles missing args gracefully", () => {
    const display = resolveToolDisplay({ name: "exec" });
    const summary = formatToolSummary(display);
    expect(summary).toBe("🛠️ Exec");
  });

  it("handles write tool", () => {
    const display = resolveToolDisplay({ name: "write", args: { path: "/tmp/out.txt" } });
    const summary = formatToolSummary(display);
    expect(summary).toContain("✍️");
    expect(summary).toContain("/tmp/out.txt");
  });

  it("handles edit tool", () => {
    const display = resolveToolDisplay({ name: "edit", args: { path: "config.json" } });
    const summary = formatToolSummary(display);
    expect(summary).toContain("📝");
    expect(summary).toContain("config.json");
  });

  it("handles browser open with URL", () => {
    const display = resolveToolDisplay({
      name: "browser",
      args: { action: "open", targetUrl: "https://example.com" },
    });
    const summary = formatToolSummary(display);
    expect(summary).toContain("🌐");
    expect(summary).toContain("open");
    expect(summary).toContain("https://example.com");
  });

  it("handles malformed URL in browser args without crashing", () => {
    // This tests the URL parsing bug fix from PR #9568
    const display = resolveToolDisplay({
      name: "browser",
      args: { action: "open", targetUrl: "not-a-valid-url://[broken" },
    });
    const summary = formatToolSummary(display);
    expect(summary).toContain("🌐");
    // Should not throw, just include the raw string
    expect(summary).toContain("not-a-valid-url://[broken");
  });

  it("truncates long detail values", () => {
    const longCommand = "a".repeat(200);
    const display = resolveToolDisplay({ name: "exec", args: { command: longCommand } });
    const summary = formatToolSummary(display);
    expect(summary.length).toBeLessThan(220);
  });
});
