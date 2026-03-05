import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessageMattermost } from "./send.js";

const mockState = vi.hoisted(() => ({
  loadOutboundMediaFromUrl: vi.fn(),
  createMattermostClient: vi.fn(),
  createMattermostDirectChannel: vi.fn(),
  createMattermostPost: vi.fn(),
  fetchMattermostMe: vi.fn(),
  fetchMattermostTeams: vi.fn(),
  fetchMattermostChannelByTeamAndName: vi.fn(),
  fetchMattermostUserByUsername: vi.fn(),
  normalizeMattermostBaseUrl: vi.fn((input: string | undefined) => input?.trim() ?? ""),
  uploadMattermostFile: vi.fn(),
}));

vi.mock("openclaw/plugin-sdk", () => ({
  loadOutboundMediaFromUrl: mockState.loadOutboundMediaFromUrl,
}));

vi.mock("./accounts.js", () => ({
  resolveMattermostAccount: () => ({
    accountId: "default",
    botToken: "bot-token",
    baseUrl: "https://mattermost.example.com",
  }),
}));

vi.mock("./client.js", () => ({
  createMattermostClient: mockState.createMattermostClient,
  createMattermostDirectChannel: mockState.createMattermostDirectChannel,
  createMattermostPost: mockState.createMattermostPost,
  fetchMattermostMe: mockState.fetchMattermostMe,
  fetchMattermostTeams: mockState.fetchMattermostTeams,
  fetchMattermostChannelByTeamAndName: mockState.fetchMattermostChannelByTeamAndName,
  fetchMattermostUserByUsername: mockState.fetchMattermostUserByUsername,
  normalizeMattermostBaseUrl: mockState.normalizeMattermostBaseUrl,
  uploadMattermostFile: mockState.uploadMattermostFile,
}));

vi.mock("../runtime.js", () => ({
  getMattermostRuntime: () => ({
    config: {
      loadConfig: () => ({}),
    },
    logging: {
      shouldLogVerbose: () => false,
      getChildLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
    },
    channel: {
      text: {
        resolveMarkdownTableMode: () => "off",
        convertMarkdownTables: (text: string) => text,
      },
      activity: {
        record: vi.fn(),
      },
    },
  }),
}));

describe("sendMessageMattermost", () => {
  beforeEach(() => {
    mockState.loadOutboundMediaFromUrl.mockReset();
    mockState.createMattermostClient.mockReset();
    mockState.createMattermostDirectChannel.mockReset();
    mockState.createMattermostPost.mockReset();
    mockState.fetchMattermostMe.mockReset();
    mockState.fetchMattermostTeams.mockReset();
    mockState.fetchMattermostChannelByTeamAndName.mockReset();
    mockState.fetchMattermostUserByUsername.mockReset();
    mockState.uploadMattermostFile.mockReset();

    mockState.createMattermostClient.mockReturnValue({});
    mockState.createMattermostPost.mockResolvedValue({ id: "post-1" });
    mockState.uploadMattermostFile.mockResolvedValue({ id: "file-1" });
    mockState.fetchMattermostTeams.mockResolvedValue([{ id: "team-1" }]);
    mockState.fetchMattermostChannelByTeamAndName.mockResolvedValue({
      id: "uzuybrkzk3y3fjr9ufgcdumtzy",
      name: "private-notes",
    });
  });

  it("loads outbound media with trusted local roots before upload", async () => {
    const channelId = "jr5g74ppopgwpkymb45u57myxe";
    mockState.loadOutboundMediaFromUrl.mockResolvedValueOnce({
      buffer: Buffer.from("media-bytes"),
      fileName: "photo.png",
      contentType: "image/png",
      kind: "image",
    });

    await sendMessageMattermost(`channel:${channelId}`, "hello", {
      mediaUrl: "file:///tmp/agent-workspace/photo.png",
      mediaLocalRoots: ["/tmp/agent-workspace"],
    });

    expect(mockState.loadOutboundMediaFromUrl).toHaveBeenCalledWith(
      "file:///tmp/agent-workspace/photo.png",
      {
        mediaLocalRoots: ["/tmp/agent-workspace"],
      },
    );
    expect(mockState.uploadMattermostFile).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        channelId,
        fileName: "photo.png",
        contentType: "image/png",
      }),
    );
  });

  it("resolves channel:<name> via team channel lookup before posting", async () => {
    await sendMessageMattermost("channel:private-notes", "hello from test");

    expect(mockState.fetchMattermostTeams).toHaveBeenCalledTimes(1);
    expect(mockState.fetchMattermostChannelByTeamAndName).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        teamId: "team-1",
        channelName: "private-notes",
      }),
    );
    expect(mockState.createMattermostPost).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        channelId: "uzuybrkzk3y3fjr9ufgcdumtzy",
        message: "hello from test",
      }),
    );
  });

  it("keeps id-like channel targets as direct ids", async () => {
    const targetId = "jr5g74ppopgwpkymb45u57myxe";

    await sendMessageMattermost(targetId, "id route");

    expect(mockState.fetchMattermostTeams).not.toHaveBeenCalled();
    expect(mockState.fetchMattermostChannelByTeamAndName).not.toHaveBeenCalled();
    expect(mockState.createMattermostPost).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        channelId: targetId,
      }),
    );
  });

  it("throws a clear error when channel name cannot be resolved", async () => {
    mockState.fetchMattermostChannelByTeamAndName.mockRejectedValue(
      new Error(
        'Mattermost API 404 Not Found: {"id":"app.channel.get_by_name.missing.app_error","status_code":404}',
      ),
    );

    await expect(sendMessageMattermost("not-found", "hello")).rejects.toThrow(
      'Mattermost channel "not-found" was not found for this bot account.',
    );
  });
});
