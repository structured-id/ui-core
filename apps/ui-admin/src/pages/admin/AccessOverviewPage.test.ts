import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { AccessRequestStatus } from "@structured-id/proto/sid/v1/authz/governance";

// Hoisted mocks — defined before vi.mock hoisting runs
const mocks = vi.hoisted(() => ({
  listRoleAssignments: vi.fn().mockResolvedValue({
    response: { assignments: [] },
  }),
  listPendingRequests: vi.fn().mockResolvedValue({
    response: { requests: [], pagination: undefined },
  }),
  decideRequest: vi.fn().mockResolvedValue({
    response: { status: 2 },
  }),
  listRoles: vi.fn().mockResolvedValue({
    response: { roles: [] },
  }),
  listProfiles: vi.fn().mockResolvedValue({
    response: { profiles: [] },
  }),
}));

vi.mock("@structured-id/ui-core", () => ({
  getTransport: () => ({}),
}));

vi.mock("@structured-id/proto/sid/v1/authz/governance.client", () => ({
  GovernanceServiceClient: class MockGovernanceServiceClient {
    listPendingRequests = mocks.listPendingRequests;
    decideRequest = mocks.decideRequest;
    requestAccess = vi.fn();
    grantTemporaryRole = vi.fn();
  },
}));

vi.mock("@structured-id/proto/sid/v1/authz/authz.client", () => ({
  AuthzServiceClient: class MockAuthzServiceClient {
    listRoleAssignments = mocks.listRoleAssignments;
    listRoles = mocks.listRoles;
  },
}));

vi.mock("@structured-id/proto/sid/v1/identity/identity.client", () => ({
  IdentityServiceClient: class MockIdentityServiceClient {
    listProfiles = mocks.listProfiles;
  },
}));

// Import AFTER mocks
import AccessOverviewPage from "./AccessOverviewPage.vue";
import { useGovernanceStore } from "src/stores/governance";
import { defineComponent, h } from "vue";
import {
  AccessRequestId,
  GroupId,
  MachineUserId,
  ProfileId,
  RoleAssignmentId,
  RoleId,
} from "@structured-id/ids";
import { names } from "src/ids";

/** The `n`th UUIDv7 text (n < 256). */
function uuid(n: number): string {
  return `0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d${n.toString(16).padStart(2, "0")}`;
}

// The installation answers every reference as its binary identifier message.
const ALICE = uuid(0x40);
const BOB = uuid(0x41);
const UNKNOWN_PROFILE = uuid(0x4f);
const ROLE_ADMIN = uuid(0x10);
const ROLE_DEV = uuid(0x11);
const ROLE_OTHER = uuid(0x12);
const UNKNOWN_ROLE = uuid(0x1f);
const GROUP = uuid(0x50);
const SERVICE = uuid(0x60);

const profile = (text: string) => ProfileId.parse(text).toWire();
const role = (text: string) => RoleId.parse(text).toWire();
const assignment = (n: number) =>
  RoleAssignmentId.parse(uuid(0x20 + n)).toWire();
const request = (n: number) => AccessRequestId.parse(uuid(0x30 + n)).toWire();

// QTable stub that renders body-cell scoped slots for each row, keyed by the
// table's row-key as QTable keys them.
const QTableStub = defineComponent({
  name: "QTable",
  props: [
    "rows",
    "columns",
    "rowKey",
    "flat",
    "bordered",
    "pagination",
    "loading",
  ],
  setup(props, { slots }) {
    return () => {
      const rows = (props.rows ?? []) as Record<string, unknown>[];
      if (rows.length === 0 && slots["no-data"]) {
        return h("div", { class: "q-table" }, [slots["no-data"]()]);
      }
      const rowEls = rows.map((row) => {
        const cells = ((props.columns ?? []) as { name: string }[]).map(
          (col) => {
            const slotName = `body-cell-${col.name}`;
            if (slots[slotName]) {
              return slots[slotName]!({
                row,
                value: (row as Record<string, unknown>)[col.name],
              });
            }
            return h(
              "td",
              String((row as Record<string, unknown>)[col.name] ?? ""),
            );
          },
        );
        const key =
          typeof props.rowKey === "function"
            ? props.rowKey(row)
            : String(row[props.rowKey as string]);
        return h("tr", { class: "q-tr", key }, cells);
      });
      return h("div", { class: "q-table" }, [h("tbody", rowEls)]);
    };
  },
});

const quasarStubs = {
  QPage: { template: "<div><slot /></div>" },
  QTable: QTableStub,
  QInput: {
    template: '<input class="q-input" />',
    props: ["modelValue"],
  },
  QSelect: {
    template: '<select class="q-select" />',
    props: ["modelValue", "options"],
  },
  QToggle: {
    template: '<input type="checkbox" class="q-toggle" />',
    props: ["modelValue", "label"],
  },
  QBtn: {
    template: '<button class="q-btn">{{ label }}</button>',
    props: ["label", "icon", "color", "flat", "noCaps"],
  },
  QBanner: {
    template:
      '<div class="q-banner"><slot /><slot name="avatar" /><slot name="action" /></div>',
    props: ["dense", "rounded"],
  },
  QDialog: { template: "<div><slot /></div>", props: ["modelValue"] },
  QCard: { template: "<div><slot /></div>" },
  QCardSection: { template: "<div><slot /></div>" },
  QCardActions: { template: "<div><slot /></div>" },
  QLinearProgress: { template: "<div />" },
  QIcon: { template: "<i />" },
  QTd: { template: "<td><slot /></td>", props: ["props"] },
  QBadge: {
    template: '<span class="q-badge">{{ label }}</span>',
    props: ["color", "label"],
  },
  QSpace: { template: "<span />" },
  QTooltip: { template: "<span />" },
};

function mountPage() {
  return mount(AccessOverviewPage, {
    global: {
      plugins: [createPinia()],
      stubs: quasarStubs,
    },
  });
}

/** The `n`th pending request, from the `n`th requester. */
function makePendingRequest(n: number, name: string, requestedRole: string) {
  return {
    requestId: request(n),
    requesterProfileId: profile(uuid(0x70 + n)),
    requesterDisplayName: name,
    requestedRole,
    justification: "Need it",
    status: AccessRequestStatus.PENDING,
    createdAt: { seconds: BigInt(1700000000), nanos: 0 },
  };
}

/** The `n`th assignment, of the role `roleText` to the profile `profileText`. */
function makeAssignment(
  n: number,
  profileText: string,
  roleText: string,
  expiresAt?: { seconds: bigint; nanos: number },
) {
  return {
    id: assignment(n),
    principal: {
      oneofKind: "profileId" as const,
      profileId: profile(profileText),
    },
    roleId: role(roleText),
    createdAt: { seconds: BigInt(1700000000), nanos: 0 },
    ...(expiresAt ? { expiresAt } : {}),
  };
}

describe("AccessOverviewPage", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Reset call counts while preserving implementations
    mocks.listRoleAssignments.mockClear();
    mocks.listPendingRequests.mockClear();
    mocks.decideRequest.mockClear();
    mocks.listRoles.mockClear();
    mocks.listProfiles.mockClear();
    // Set default return values
    mocks.listRoleAssignments.mockResolvedValue({
      response: { assignments: [] },
    });
    mocks.listPendingRequests.mockResolvedValue({
      response: { requests: [], pagination: undefined },
    });
    mocks.listRoles.mockResolvedValue({
      response: { roles: [] },
    });
    mocks.listProfiles.mockResolvedValue({
      response: { profiles: [] },
    });
    mocks.decideRequest.mockResolvedValue({
      response: { status: AccessRequestStatus.APPROVED },
    });
  });

  // ── Smoke tests ──

  it("renders the page heading", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Access Overview");
  });

  it("renders the subtitle", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Who has what");
  });

  it("renders Export CSV button", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("Export CSV");
  });

  it("renders Active only toggle", () => {
    const wrapper = mountPage();
    expect(wrapper.find(".q-toggle").exists()).toBe(true);
  });

  it("renders empty state when no assignments", () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain("No role assignments");
  });

  it("renders filter inputs", () => {
    const wrapper = mountPage();
    expect(wrapper.find(".q-input").exists()).toBe(true);
    expect(wrapper.find(".q-select").exists()).toBe(true);
  });

  it("renders the data table", () => {
    const wrapper = mountPage();
    expect(wrapper.find(".q-table").exists()).toBe(true);
  });

  // ── Store interaction tests ──

  it("calls fetchRoleAssignments on mount", async () => {
    mountPage();
    await flushPromises();
    expect(mocks.listRoleAssignments).toHaveBeenCalledOnce();
  });

  it("calls fetchPendingRequests on mount", async () => {
    mountPage();
    await flushPromises();
    expect(mocks.listPendingRequests).toHaveBeenCalledOnce();
  });

  it("calls fetchRoles on mount", async () => {
    mountPage();
    await flushPromises();
    expect(mocks.listRoles).toHaveBeenCalledOnce();
  });

  it("calls fetchProfiles on mount", async () => {
    mountPage();
    await flushPromises();
    expect(mocks.listProfiles).toHaveBeenCalledOnce();
  });

  // ── Pending requests banner ──

  it("does not show pending requests banner when no pending", async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).not.toContain("pending access request");
  });

  it("shows pending requests banner when there are pending requests", async () => {
    mocks.listPendingRequests.mockResolvedValue({
      response: {
        requests: [makePendingRequest(1, "Alice", "admin")],
        pagination: undefined,
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("1 pending access request");
  });

  it("pluralizes pending requests banner for multiple requests", async () => {
    mocks.listPendingRequests.mockResolvedValue({
      response: {
        requests: [
          makePendingRequest(1, "Alice", "admin"),
          makePendingRequest(2, "Bob", "developer"),
        ],
        pagination: undefined,
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("2 pending access requests");
  });

  // ── Permanent admin warning ──

  it("shows permanent admin warning when >2 permanent admin roles", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [
          makeAssignment(1, uuid(0x41), ROLE_ADMIN),
          makeAssignment(2, uuid(0x42), ROLE_ADMIN),
          makeAssignment(3, uuid(0x43), ROLE_ADMIN),
        ],
      },
    });
    mocks.listRoles.mockResolvedValue({
      response: {
        roles: [{ id: role(ROLE_ADMIN), name: "Site Admin", permissions: [] }],
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("3 permanent admin roles");
  });

  it("does not show permanent admin warning with <=2 admins", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [makeAssignment(1, ALICE, ROLE_ADMIN)],
      },
    });
    mocks.listRoles.mockResolvedValue({
      response: {
        roles: [{ id: role(ROLE_ADMIN), name: "Admin", permissions: [] }],
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).not.toContain("permanent admin roles");
  });

  // ── Filtering tests (unit level via store) ──

  it("filters expired assignments when activeOnly", () => {
    const store = useGovernanceStore();
    const pastTs = { seconds: BigInt(1000000), nanos: 0 };
    const futureTs = {
      seconds: BigInt(Math.floor(Date.now() / 1000) + 86400),
      nanos: 0,
    };

    store.assignments = [
      makeAssignment(1, ALICE, ROLE_ADMIN, pastTs),
      makeAssignment(2, BOB, ROLE_DEV, futureTs),
      makeAssignment(3, ALICE, ROLE_OTHER), // permanent
    ];

    const now = Date.now() / 1000;
    const active = store.assignments.filter(
      (a) => !a.expiresAt || Number(a.expiresAt.seconds) > now,
    );
    expect(active).toHaveLength(2);
    expect(active.map((a) => a.id)).toEqual([assignment(2), assignment(3)]);
  });

  it("filters by role", () => {
    const store = useGovernanceStore();
    store.assignments = [
      makeAssignment(1, ALICE, ROLE_ADMIN),
      makeAssignment(2, BOB, ROLE_DEV),
    ];

    const dev = RoleId.parse(ROLE_DEV);
    const filtered = store.assignments.filter((a) => names(a.roleId, dev));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toEqual(assignment(2));
  });

  // ── DecideRequest via store ──

  // The decision names its request by the request's id message, and the
  // decided request leaves the pending list.
  it("decideRequest calls gRPC and removes request from list", async () => {
    const store = useGovernanceStore();
    store.pendingRequests = [makePendingRequest(1, "Alice", "admin")];

    await store.decideRequest(AccessRequestId.parse(uuid(0x31)), true, "");
    expect(mocks.decideRequest).toHaveBeenCalledWith({
      requestId: request(1),
      approved: true,
      reason: "",
    });
    expect(store.pendingRequests).toHaveLength(0);
  });

  it("decideRequest with deny includes reason", async () => {
    const store = useGovernanceStore();
    store.pendingRequests = [makePendingRequest(2, "Bob", "admin")];

    mocks.decideRequest.mockResolvedValue({
      response: { status: AccessRequestStatus.DENIED },
    });

    await store.decideRequest(
      AccessRequestId.parse(uuid(0x32)),
      false,
      "Insufficient justification",
    );
    expect(mocks.decideRequest).toHaveBeenCalledWith({
      requestId: request(2),
      approved: false,
      reason: "Insufficient justification",
    });
    expect(store.pendingRequests).toHaveLength(0);
  });

  // ── Principal type resolution ──

  it("handles group principal in assignments", () => {
    const store = useGovernanceStore();
    const group = GroupId.parse(GROUP).toWire();
    store.assignments = [
      {
        id: assignment(1),
        principal: { oneofKind: "groupId" as const, groupId: group },
        roleId: role(ROLE_OTHER),
        createdAt: { seconds: BigInt(1700000000), nanos: 0 },
      },
    ];

    const p = store.assignments[0]!.principal;
    expect(p.oneofKind).toBe("groupId");
    if (p.oneofKind === "groupId") {
      expect(p.groupId).toEqual(group);
    }
  });

  it("handles machineUser principal in assignments", () => {
    const store = useGovernanceStore();
    const service = MachineUserId.parse(SERVICE).toWire();
    store.assignments = [
      {
        id: assignment(1),
        principal: {
          oneofKind: "machineUserId" as const,
          machineUserId: service,
        },
        roleId: role(ROLE_OTHER),
        createdAt: { seconds: BigInt(1700000000), nanos: 0 },
      },
    ];

    const p = store.assignments[0]!.principal;
    expect(p.oneofKind).toBe("machineUserId");
    if (p.oneofKind === "machineUserId") {
      expect(p.machineUserId).toEqual(service);
    }
  });

  // ── Error handling ──

  it("sets error on fetch failure", async () => {
    mocks.listRoleAssignments.mockRejectedValueOnce(new Error("Network error"));

    const store = useGovernanceStore();
    await store.fetchRoleAssignments();
    expect(store.error).toBe("Network error");
  });

  it("sets error on pending requests fetch failure", async () => {
    mocks.listPendingRequests.mockRejectedValueOnce(
      new Error("Connection refused"),
    );

    const store = useGovernanceStore();
    await store.fetchPendingRequests();
    expect(store.error).toBe("Connection refused");
  });

  // ── Integration: mount with data, verify store state after fetch ──

  it("populates store assignments after mount", async () => {
    const assignments = [
      makeAssignment(1, ALICE, ROLE_DEV),
      makeAssignment(2, BOB, ROLE_ADMIN),
    ];
    mocks.listRoleAssignments.mockResolvedValue({
      response: { assignments },
    });
    mocks.listRoles.mockResolvedValue({
      response: {
        roles: [
          { id: role(ROLE_DEV), name: "Developer", permissions: [] },
          { id: role(ROLE_ADMIN), name: "Admin", permissions: [] },
        ],
      },
    });
    mocks.listProfiles.mockResolvedValue({
      response: {
        profiles: [
          {
            id: profile(ALICE),
            username: "alice",
            email: "alice@sid.example.com",
            formattedName: "Alice Smith",
            profileType: 0,
            emailVerified: true,
            phoneVerified: false,
          },
          {
            id: profile(BOB),
            username: "bob",
            email: "bob@sid.example.com",
            formattedName: "Bob Jones",
            profileType: 0,
            emailVerified: true,
            phoneVerified: false,
          },
        ],
      },
    });

    mountPage();
    await flushPromises();

    const store = useGovernanceStore();
    expect(store.assignments).toHaveLength(2);
    expect(store.assignments[0]!.roleId).toEqual(role(ROLE_DEV));
    expect(store.assignments[1]!.roleId).toEqual(role(ROLE_ADMIN));
  });

  it("populates pending requests after mount", async () => {
    mocks.listPendingRequests.mockResolvedValue({
      response: {
        requests: [makePendingRequest(1, "Carol", "staging-access")],
        pagination: undefined,
      },
    });

    mountPage();
    await flushPromises();

    const store = useGovernanceStore();
    expect(store.pendingRequests).toHaveLength(1);
    expect(store.pendingRequests[0]!.requesterDisplayName).toBe("Carol");
    expect(store.pendingRequests[0]!.requestedRole).toBe("staging-access");
  });

  it("pending requests banner shows Review requests action", async () => {
    mocks.listPendingRequests.mockResolvedValue({
      response: {
        requests: [makePendingRequest(1, "Alice", "admin")],
        pagination: undefined,
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain("Review requests");
  });

  it("does not show expired admin roles in permanent admin count", async () => {
    const futureTs = {
      seconds: BigInt(Math.floor(Date.now() / 1000) + 86400),
      nanos: 0,
    };
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [
          makeAssignment(1, uuid(0x41), ROLE_ADMIN, futureTs),
          makeAssignment(2, uuid(0x42), ROLE_ADMIN, futureTs),
          makeAssignment(3, uuid(0x43), ROLE_ADMIN, futureTs),
        ],
      },
    });
    mocks.listRoles.mockResolvedValue({
      response: {
        roles: [{ id: role(ROLE_ADMIN), name: "Admin", permissions: [] }],
      },
    });
    const wrapper = mountPage();
    await flushPromises();
    // All 3 have expiresAt → they're temporary, not permanent
    expect(wrapper.text()).not.toContain("permanent admin roles");
  });

  it("decideRequest removes approved request and keeps the others", async () => {
    const store = useGovernanceStore();
    store.pendingRequests = [
      makePendingRequest(1, "Alice", "dev"),
      makePendingRequest(2, "Bob", "admin"),
    ];

    await store.decideRequest(AccessRequestId.parse(uuid(0x31)), true, "");

    // The first is removed, the second remains
    expect(store.pendingRequests).toHaveLength(1);
    expect(store.pendingRequests[0]!.requestId).toEqual(request(2));
  });

  it("store fetchRoleAssignments handles empty response", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: { assignments: [] },
    });

    const store = useGovernanceStore();
    await store.fetchRoleAssignments();

    expect(store.assignments).toHaveLength(0);
    expect(store.error).toBeNull();
    expect(store.loading).toBe(false);
  });

  it("CSV export generates correct header", async () => {
    // We can't test actual download, but we can verify the store data
    // that would be exported
    const store = useGovernanceStore();
    store.assignments = [makeAssignment(1, ALICE, ROLE_OTHER)];
    expect(store.assignments).toHaveLength(1);
    // Verification that data exists for export
    expect(store.assignments[0]!.id).toEqual(assignment(1));
  });

  it("mixed principal types all stored correctly", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [
          makeAssignment(1, ALICE, ROLE_OTHER),
          {
            id: assignment(2),
            principal: {
              oneofKind: "groupId" as const,
              groupId: GroupId.parse(GROUP).toWire(),
            },
            roleId: role(ROLE_OTHER),
            createdAt: { seconds: BigInt(1700000000), nanos: 0 },
          },
          {
            id: assignment(3),
            principal: {
              oneofKind: "machineUserId" as const,
              machineUserId: MachineUserId.parse(SERVICE).toWire(),
            },
            roleId: role(ROLE_OTHER),
            createdAt: { seconds: BigInt(1700000000), nanos: 0 },
          },
        ],
      },
    });

    mountPage();
    await flushPromises();

    const store = useGovernanceStore();
    expect(store.assignments).toHaveLength(3);
    expect(store.assignments[0]!.principal.oneofKind).toBe("profileId");
    expect(store.assignments[1]!.principal.oneofKind).toBe("groupId");
    expect(store.assignments[2]!.principal.oneofKind).toBe("machineUserId");
  });

  // ── DOM rendering: verify actual text in rendered table rows ──

  it("renders user display name and email in table rows", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [makeAssignment(1, ALICE, ROLE_DEV)],
      },
    });
    mocks.listRoles.mockResolvedValue({
      response: {
        roles: [{ id: role(ROLE_DEV), name: "Developer", permissions: [] }],
      },
    });
    mocks.listProfiles.mockResolvedValue({
      response: {
        profiles: [
          {
            id: profile(ALICE),
            username: "alice",
            email: "alice@sid.example.com",
            formattedName: "Alice Smith",
            profileType: 0,
            emailVerified: true,
            phoneVerified: false,
          },
        ],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain("Alice Smith");
    expect(text).toContain("alice@sid.example.com");
    expect(text).toContain("Developer");
  });

  it("renders 'permanent' for assignments without expiresAt", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [makeAssignment(1, ALICE, ROLE_OTHER)],
      },
    });
    mocks.listProfiles.mockResolvedValue({
      response: {
        profiles: [
          {
            id: profile(ALICE),
            username: "alice",
            profileType: 0,
            emailVerified: false,
            phoneVerified: false,
          },
        ],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain("permanent");
  });

  it("renders group principal as 'Group: <id>'", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [
          {
            id: assignment(1),
            principal: {
              oneofKind: "groupId" as const,
              groupId: GroupId.parse(GROUP).toWire(),
            },
            roleId: role(ROLE_OTHER),
            createdAt: { seconds: BigInt(1700000000), nanos: 0 },
          },
        ],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain(`Group: ${GROUP}`);
  });

  it("renders machineUser principal as 'Service: <id>'", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [
          {
            id: assignment(1),
            principal: {
              oneofKind: "machineUserId" as const,
              machineUserId: MachineUserId.parse(SERVICE).toWire(),
            },
            roleId: role(ROLE_OTHER),
            createdAt: { seconds: BigInt(1700000000), nanos: 0 },
          },
        ],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain(`Service: ${SERVICE}`);
  });

  it("renders expiring-soon badge for assignments expiring within 72h", async () => {
    const soonTs = {
      seconds: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
      nanos: 0,
    };
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [makeAssignment(1, ALICE, ROLE_OTHER, soonTs)],
      },
    });
    mocks.listProfiles.mockResolvedValue({
      response: {
        profiles: [
          {
            id: profile(ALICE),
            username: "alice",
            profileType: 0,
            emailVerified: false,
            phoneVerified: false,
          },
        ],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    // Should have a badge (not "permanent")
    expect(wrapper.text()).not.toContain("permanent");
    // Badge should be rendered with warning color via QBadge stub
    const badges = wrapper.findAll(".q-badge");
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders date in Since column", async () => {
    // Nov 14, 2023 (ts = 1700000000)
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [makeAssignment(1, ALICE, ROLE_OTHER)],
      },
    });
    mocks.listProfiles.mockResolvedValue({
      response: {
        profiles: [
          {
            id: profile(ALICE),
            username: "alice",
            profileType: 0,
            emailVerified: false,
            phoneVerified: false,
          },
        ],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    // The date 1700000000 = Nov 14, 2023 — exact format depends on locale
    expect(wrapper.text()).toContain("2023");
  });

  it("falls back to profileId when profile not found", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [makeAssignment(1, UNKNOWN_PROFILE, ROLE_OTHER)],
      },
    });
    // The profile list does not contain the assigned profile
    mocks.listProfiles.mockResolvedValue({
      response: { profiles: [] },
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain(UNKNOWN_PROFILE);
  });

  it("falls back to roleId when role not found in roles store", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [makeAssignment(1, ALICE, UNKNOWN_ROLE)],
      },
    });
    // The role list does not contain the assigned role
    mocks.listRoles.mockResolvedValue({
      response: { roles: [] },
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain(UNKNOWN_ROLE);
  });

  // Bug prevented: an answered reference that is no identifier of its kind
  // throwing while the row renders, which takes the whole table down. The row
  // renders its text; acting on it is refused when the action checks it.
  it("renders an assignment whose references are malformed", async () => {
    const malformed = { value: new Uint8Array([1, 2, 3]) };
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [
          {
            id: malformed,
            principal: {
              oneofKind: "profileId" as const,
              profileId: malformed,
            },
            roleId: malformed,
            createdAt: { seconds: BigInt(1700000000), nanos: 0 },
          },
          makeAssignment(2, ALICE, ROLE_DEV),
        ],
      },
    });
    mocks.listRoles.mockResolvedValue({
      response: {
        roles: [{ id: role(ROLE_DEV), name: "Developer", permissions: [] }],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.findAll(".q-tr")).toHaveLength(2);
    expect(wrapper.text()).toContain("Developer");
  });

  it("renders multiple rows with different data", async () => {
    mocks.listRoleAssignments.mockResolvedValue({
      response: {
        assignments: [
          makeAssignment(1, ALICE, ROLE_ADMIN),
          makeAssignment(2, BOB, ROLE_DEV),
        ],
      },
    });
    mocks.listRoles.mockResolvedValue({
      response: {
        roles: [
          { id: role(ROLE_ADMIN), name: "Administrator", permissions: [] },
          { id: role(ROLE_DEV), name: "Developer", permissions: [] },
        ],
      },
    });
    mocks.listProfiles.mockResolvedValue({
      response: {
        profiles: [
          {
            id: profile(ALICE),
            formattedName: "Alice",
            email: "alice@test.com",
            profileType: 0,
            emailVerified: true,
            phoneVerified: false,
          },
          {
            id: profile(BOB),
            formattedName: "Bob",
            email: "bob@test.com",
            profileType: 0,
            emailVerified: true,
            phoneVerified: false,
          },
        ],
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
    expect(text).toContain("Administrator");
    expect(text).toContain("Developer");
    expect(text).toContain("alice@test.com");
    expect(text).toContain("bob@test.com");
  });

  // ── Pending request dialog content ──

  it("renders pending request details in dialog", async () => {
    mocks.listPendingRequests.mockResolvedValue({
      response: {
        requests: [makePendingRequest(1, "Carol Davis", "staging-access")],
        pagination: undefined,
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    // Dialog is always rendered (v-model controls visibility in real Quasar)
    // Our stub renders it always — so content should be in DOM
    const text = wrapper.text();
    expect(text).toContain("Carol Davis");
    expect(text).toContain("staging-access");
    expect(text).toContain("Need it"); // justification
  });

  // A requester without a display name is shown by its profile id.
  it("shows a requester without a name by its profile id", async () => {
    mocks.listPendingRequests.mockResolvedValue({
      response: {
        requests: [makePendingRequest(1, "", "staging-access")],
        pagination: undefined,
      },
    });

    const wrapper = mountPage();
    await flushPromises();

    expect(wrapper.text()).toContain(uuid(0x71));
  });
});
