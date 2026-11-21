import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPinia, setActivePinia } from "pinia";

// The store's only boundary is the enrollment client; the server answers
// with the invites it created, so these mocks echo what a server returns.
const mocks = vi.hoisted(() => ({
  createInvite: vi.fn(),
  bulkCreateInvites: vi.fn(),
  revokeInvite: vi.fn().mockResolvedValue({ response: {} }),
  listInvites: vi.fn(),
  getRegistrationStats: vi.fn(),
}));

vi.mock("@structured-id/ui-core", () => ({ getAccountTransport: () => ({}) }));

vi.mock("@structured-id/proto/sid/v1/admin/enrollment.client", () => ({
  EnrollmentServiceClient: class {
    createInvite = mocks.createInvite;
    bulkCreateInvites = mocks.bulkCreateInvites;
    revokeInvite = mocks.revokeInvite;
    listInvites = mocks.listInvites;
    getRegistrationStats = mocks.getRegistrationStats;
  },
}));

import { InviteStatus, useEnrollmentStore } from "./enrollment";
import { InviteId } from "@structured-id/ids";

/** An invite identifier as the server issues them (UUIDv7). */
const INVITE = InviteId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d9e");

function serverInvite(code: string) {
  return {
    id: INVITE.toWire(),
    code,
    createdBy: { oneofKind: undefined },
    createdByName: "",
    metadata: {},
    maxUses: 0,
    useCount: 0,
    active: true,
    status: InviteStatus.ACTIVE,
  };
}

describe("enrollment store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  // A zero use count in the form is "no limit"; on the wire a zero max_uses
  // means the policy default, so the store must ask for unlimited_uses.
  it("asks the server for an unlimited invite when uses is 0", async () => {
    mocks.createInvite.mockResolvedValue({ response: serverInvite("ABC") });
    const store = useEnrollmentStore();

    const invite = await store.createInvite(
      { maxUses: 0, expiresAt: null },
      { team: "ops" },
    );

    expect(mocks.createInvite).toHaveBeenCalledWith({
      maxUses: 0,
      unlimitedUses: true,
      expiresAt: undefined,
      neverExpires: false,
      metadata: { team: "ops" },
    });
    // The code shown is the one the server issued, never a local invention.
    expect(invite?.code).toBe("ABC");
    expect(store.invites.map((i) => i.code)).toEqual(["ABC"]);
  });

  // A limited invite sends its count and an explicit expiry as a timestamp.
  it("sends a limited count and an explicit expiry", async () => {
    mocks.createInvite.mockResolvedValue({ response: serverInvite("DEF") });
    const store = useEnrollmentStore();
    const expiresAt = new Date("2027-01-02T03:04:05Z");

    await store.createInvite({ maxUses: 3, expiresAt }, {});

    const request = mocks.createInvite.mock.calls[0][0];
    expect(request.maxUses).toBe(3);
    expect(request.unlimitedUses).toBe(false);
    expect(Number(request.expiresAt.seconds)).toBe(expiresAt.getTime() / 1000);
  });

  // A failed creation leaves the list untouched and reports the error.
  it("keeps the list unchanged when creation fails", async () => {
    mocks.createInvite.mockRejectedValue(new Error("refused"));
    const store = useEnrollmentStore();

    const invite = await store.createInvite(
      { maxUses: 1, expiresAt: null },
      {},
    );

    expect(invite).toBeNull();
    expect(store.invites).toEqual([]);
    expect(store.error).toBe("refused");
  });

  // Revocation names the invite by its binary identifier and marks the
  // listed copy revoked only after the server accepted it.
  it("revokes by binary identifier and marks the listed invite", async () => {
    mocks.createInvite.mockResolvedValue({ response: serverInvite("GHI") });
    const store = useEnrollmentStore();
    await store.createInvite({ maxUses: 1, expiresAt: null }, {});

    await store.revokeInvite(INVITE);

    expect(mocks.revokeInvite).toHaveBeenCalledWith({
      inviteId: INVITE.toWire(),
    });
    expect(store.invites[0].status).toBe(InviteStatus.REVOKED);
    expect(store.invites[0].active).toBe(false);
  });

  // A refused revocation must not show the invite as revoked.
  it("leaves the invite active when revocation fails", async () => {
    mocks.createInvite.mockResolvedValue({ response: serverInvite("JKL") });
    mocks.revokeInvite.mockRejectedValueOnce(new Error("denied"));
    const store = useEnrollmentStore();
    await store.createInvite({ maxUses: 1, expiresAt: null }, {});

    await expect(store.revokeInvite(INVITE)).rejects.toThrow("denied");

    expect(store.invites[0].status).toBe(InviteStatus.ACTIVE);
  });

  // The list filter goes to the server; no status means every status.
  it("passes the status filter and search to the server", async () => {
    mocks.listInvites.mockResolvedValue({
      response: {
        invites: [serverInvite("MNO")],
        nextPageToken: "",
        totalCount: 7,
      },
    });
    const store = useEnrollmentStore();

    await store.fetchInvites(InviteStatus.REVOKED, "MN");
    expect(mocks.listInvites).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: InviteStatus.REVOKED, search: "MN" }),
    );
    expect(store.invitesTotalCount).toBe(7);

    await store.fetchInvites();
    expect(mocks.listInvites).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: InviteStatus.UNSPECIFIED, search: "" }),
    );
  });

  // Bulk creation shows exactly the invites the server returned.
  it("adds the server's bulk invites", async () => {
    mocks.bulkCreateInvites.mockResolvedValue({
      response: { invites: [serverInvite("P1"), serverInvite("P2")] },
    });
    const store = useEnrollmentStore();

    const created = await store.bulkCreateInvites(
      2,
      { maxUses: 0, expiresAt: null },
      {},
    );

    expect(mocks.bulkCreateInvites).toHaveBeenCalledWith(
      expect.objectContaining({ count: 2, unlimitedUses: true }),
    );
    expect(created.map((i) => i.code)).toEqual(["P1", "P2"]);
    expect(store.invitesTotalCount).toBe(2);
  });

  // Statistics are the server's answer for the requested period.
  it("loads registration statistics for the period", async () => {
    const stats = {
      total: 4,
      bySource: [],
      topReferrers: [],
      totalReferrals: 0,
      uniqueReferrers: 0,
    };
    mocks.getRegistrationStats.mockResolvedValue({ response: stats });
    const store = useEnrollmentStore();

    await store.fetchRegistrationStats(7);

    expect(mocks.getRegistrationStats).toHaveBeenCalledWith({ periodDays: 7 });
    expect(store.stats).toEqual(stats);
  });
});
