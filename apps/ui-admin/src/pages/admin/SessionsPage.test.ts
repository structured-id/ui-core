import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

// Hoisted mocks
const mocks = vi.hoisted(() => ({
  listSessions: vi.fn().mockResolvedValue({
    response: { sessions: [], totalCount: 0, nextPageToken: "" },
  }),
  getSessionStats: vi.fn().mockResolvedValue({
    response: {
      activeSessions: 0,
      activeUsers: 0,
      peakToday: 0,
      byClient: [],
    },
  }),
  revokeSession: vi.fn().mockResolvedValue({ response: {} }),
  revokeApplicationSessions: vi.fn().mockResolvedValue({ response: {} }),
  revokeRealmSessions: vi.fn().mockResolvedValue({
    response: { revokedCount: 0 },
  }),
}));

vi.mock("@structured-id/ui-core", () => ({
  getAccountTransport: () => ({}),
  Timestamp: {
    toDate: (ts: { seconds: bigint }) => new Date(Number(ts.seconds) * 1000),
  },
}));

vi.mock("@structured-id/proto/sid/v1/admin/sessions.client", () => ({
  SessionServiceClient: class {
    listSessions = mocks.listSessions;
    getSessionStats = mocks.getSessionStats;
    revokeSession = mocks.revokeSession;
    revokeApplicationSessions = mocks.revokeApplicationSessions;
    revokeRealmSessions = mocks.revokeRealmSessions;
  },
}));

vi.mock("quasar", () => ({
  useQuasar: () => ({ notify: vi.fn() }),
}));

import SessionsPage from "./SessionsPage.vue";
import { useSessionsStore } from "src/stores/sessions";
import { quasarStubs } from "src/test-utils/quasar-stubs";
import { SessionId } from "@structured-id/ids";

/** A session identifier as the server issues them (UUIDv7). */
const SESSION = "0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d9e";

function mountPage() {
  return mount(SessionsPage, {
    global: {
      plugins: [createPinia()],
      stubs: {
        ...quasarStubs,
        RouterLink: { template: "<a><slot /></a>" },
      },
      directives: { "close-popup": () => {} },
    },
  });
}

describe("SessionsPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mocks.listSessions.mockResolvedValue({
      response: { sessions: [], totalCount: 0, nextPageToken: "" },
    });
    mocks.getSessionStats.mockResolvedValue({
      response: {
        activeSessions: 0,
        activeUsers: 0,
        peakToday: 0,
        byClient: [],
      },
    });
  });

  it("renders the page heading", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Sessions");
  });

  it("fetches sessions and stats on mount", async () => {
    mountPage();
    await flushPromises();
    expect(mocks.listSessions).toHaveBeenCalled();
    expect(mocks.getSessionStats).toHaveBeenCalled();
  });

  it("shows stat cards", async () => {
    mocks.getSessionStats.mockResolvedValue({
      response: {
        activeSessions: 42,
        activeUsers: 15,
        peakToday: 67,
        byClient: [],
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Active Sessions");
    expect(wrapper.text()).toContain("Active Users");
    expect(wrapper.text()).toContain("Peak Sessions Today");
  });

  it("renders sessions by application when stats have client data", async () => {
    mocks.getSessionStats.mockResolvedValue({
      response: {
        activeSessions: 5,
        activeUsers: 3,
        peakToday: 10,
        byClient: [
          {
            clientId: "app-1",
            clientName: "My App",
            activeSessions: 3,
            uniqueUsers: 2,
          },
        ],
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Sessions by Application");
  });

  it("shows error banner on fetch failure", async () => {
    mocks.listSessions.mockRejectedValueOnce(new Error("Connection refused"));
    const wrapper = mountPage();
    await flushPromises();
    const store = useSessionsStore();
    expect(store.error).toBeTruthy();
    expect(wrapper.find(".q-banner").exists()).toBe(true);
  });

  it("has Sign Out All button", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Sign Out All");
  });

  it("shows empty state when no sessions", async () => {
    mountPage();
    await flushPromises();
    const store = useSessionsStore();
    expect(store.sessions).toHaveLength(0);
  });

  it("populates store with session stats", async () => {
    mocks.getSessionStats.mockResolvedValue({
      response: {
        totalActive: 10,
        activeUsers: 5,
        peakToday: 20,
        byClient: [
          {
            clientId: "app-1",
            clientName: "App One",
            activeSessions: 7,
            uniqueUsers: 3,
          },
        ],
      },
    });
    mountPage();
    await flushPromises();
    const store = useSessionsStore();
    expect(store.stats).not.toBeNull();
    expect(store.stats?.totalActive).toBe(10);
  });

  it("store.revokeSession calls gRPC", async () => {
    mocks.revokeSession.mockResolvedValue({ response: {} });
    mountPage();
    await flushPromises();
    const store = useSessionsStore();

    const id = SessionId.parse(SESSION);
    await store.revokeSession(id);
    expect(mocks.revokeSession).toHaveBeenCalledWith({
      sessionId: id.toWire(),
    });
  });

  it("store.revokeApplicationSessions calls gRPC with clientId", async () => {
    mocks.revokeApplicationSessions.mockResolvedValue({ response: {} });
    mountPage();
    await flushPromises();
    const store = useSessionsStore();

    await store.revokeApplicationSessions("app-1");
    expect(mocks.revokeApplicationSessions).toHaveBeenCalledOnce();
  });

  it("store.revokeRealmSessions calls gRPC with confirmation", async () => {
    mocks.revokeRealmSessions.mockResolvedValue({
      response: { revokedCount: 42 },
    });
    mountPage();
    await flushPromises();
    const store = useSessionsStore();

    await store.revokeRealmSessions("REVOKE ALL SESSIONS");
    expect(mocks.revokeRealmSessions).toHaveBeenCalledOnce();
  });

  it("store.revokeSession sets error on failure", async () => {
    mocks.revokeSession.mockRejectedValueOnce(new Error("Session expired"));
    mountPage();
    await flushPromises();
    const store = useSessionsStore();

    try {
      await store.revokeSession(SessionId.parse(SESSION));
    } catch {
      // store re-throws after setting error
    }
    expect(store.error).toBe("Session expired");
  });
});
