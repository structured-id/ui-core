import { beforeEach, describe, expect, it, vi } from "vitest";
import { RpcError } from "@protobuf-ts/runtime-rpc";

const mocks = vi.hoisted(() => ({ getBrowserSession: vi.fn() }));

vi.mock("@structured-id/proto/sid/v1/authn/auth.client", () => ({
  AuthServiceClient: class {
    getBrowserSession = mocks.getBrowserSession;
  },
}));

import {
  checkInstallationSession,
  initInstallationSession,
  installationSignInUrl,
  installationTransport,
} from "./useInstallationSession";

describe("installation session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    initInstallationSession("https://sid.example.com/");
  });

  // The session read answers whether one is signed in and whether it
  // administers; its expiry is a date.
  it("reads the session", async () => {
    mocks.getBrowserSession.mockResolvedValueOnce({
      response: {
        csrfToken: "t",
        administrator: true,
        expiresAt: { seconds: 1_900_000_000n, nanos: 0 },
      },
    });
    await expect(checkInstallationSession()).resolves.toEqual({
      administrator: true,
      expiresAt: new Date(1_900_000_000_000),
    });
  });

  // Signed out is null; an outage is thrown, never read as signed out.
  it("tells signed out from an outage", async () => {
    mocks.getBrowserSession.mockRejectedValueOnce(
      new RpcError("no session", "UNAUTHENTICATED"),
    );
    await expect(checkInstallationSession()).resolves.toBeNull();
    mocks.getBrowserSession.mockRejectedValueOnce(
      new RpcError("down", "UNAVAILABLE"),
    );
    await expect(checkInstallationSession()).rejects.toBeInstanceOf(RpcError);
  });

  // The account pages of the installation, without a doubled slash.
  it("signs in at the installation's account pages", () => {
    expect(installationSignInUrl()).toBe("https://sid.example.com/account/");
    expect(installationTransport()).toBeDefined();
  });
});
