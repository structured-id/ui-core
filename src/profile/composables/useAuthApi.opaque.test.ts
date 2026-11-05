import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  IdError,
  MissingIdError,
  OpaqueLoginId,
  SessionId,
} from "@structured-id/ids";
import { opaqueLoginStart, opaqueLoginFinish } from "./useAuthApi";

// Mock the gRPC transport + AuthServiceClient
const mockOpaqueLoginStart = vi.fn();
const mockOpaqueLoginFinish = vi.fn();

vi.mock("../../index", () => ({
  getTransport: vi.fn(),
  getAccountTransport: vi.fn(),
}));

vi.mock("@structured-id/proto/sid/v1/authn/auth.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  AuthServiceClient: vi.fn().mockImplementation(function () {
    return {
      opaqueLoginStart: mockOpaqueLoginStart,
      opaqueLoginFinish: mockOpaqueLoginFinish,
    };
  }),
}));

// authMeta needs to be mocked since it uses useAuth() which needs Vue context
vi.mock("../auth", () => ({
  authMeta: () => ({}),
}));

const LOGIN = OpaqueLoginId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d9e");
const SESSION = SessionId.parse("0192f3a4-7c1e-7b2a-9d4e-3f5a6b7c8d9f");

describe("OPAQUE gRPC wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("opaqueLoginStart", () => {
    // The start names its login; the finish carries that name back.
    it("sends principal and credentialRequest, reads the login it began", async () => {
      mockOpaqueLoginStart.mockResolvedValue({
        response: {
          credentialResponse: new Uint8Array([1, 2, 3]),
          loginId: LOGIN.toWire(),
        },
      });

      const result = await opaqueLoginStart(
        "alice@test.com",
        new Uint8Array([10, 20]),
      );

      expect(mockOpaqueLoginStart).toHaveBeenCalledWith({
        principal: "alice@test.com",
        credentialRequest: new Uint8Array([10, 20]),
      });
      expect(result.credentialResponse).toEqual(new Uint8Array([1, 2, 3]));
      expect(result.loginId.equals(LOGIN)).toBe(true);
    });

    // A start that names no login, or a malformed one, cannot be finished:
    // it fails here rather than sending an unusable finish.
    it("refuses an answer without a valid login", async () => {
      mockOpaqueLoginStart.mockResolvedValue({
        response: { credentialResponse: new Uint8Array([1]) },
      });
      await expect(
        opaqueLoginStart("x", new Uint8Array()),
      ).rejects.toBeInstanceOf(MissingIdError);

      mockOpaqueLoginStart.mockResolvedValue({
        response: {
          credentialResponse: new Uint8Array([1]),
          loginId: { value: new Uint8Array(15) },
        },
      });
      await expect(
        opaqueLoginStart("x", new Uint8Array()),
      ).rejects.toBeInstanceOf(IdError);
    });

    it("propagates gRPC errors", async () => {
      mockOpaqueLoginStart.mockRejectedValue(new Error("UNAVAILABLE"));
      await expect(opaqueLoginStart("x", new Uint8Array())).rejects.toThrow(
        "UNAVAILABLE",
      );
    });
  });

  describe("opaqueLoginFinish", () => {
    it("sends principal, finalization and the login's bytes, reads the session", async () => {
      mockOpaqueLoginFinish.mockResolvedValue({
        response: { sessionId: SESSION.toWire(), expiresIn: BigInt(3600) },
      });

      const result = await opaqueLoginFinish(
        "alice@test.com",
        new Uint8Array([7, 8, 9]),
        LOGIN,
      );

      expect(mockOpaqueLoginFinish).toHaveBeenCalledWith({
        principal: "alice@test.com",
        credentialFinalization: new Uint8Array([7, 8, 9]),
        loginId: { value: LOGIN.toBytes() },
      });
      expect(result.sessionId.equals(SESSION)).toBe(true);
      expect(result.expiresIn).toBe(BigInt(3600));
    });

    // Every completed sign-in names its session; an answer without one is
    // not a sign-in the page can manage.
    it("refuses an answer without its session", async () => {
      mockOpaqueLoginFinish.mockResolvedValue({
        response: { expiresIn: BigInt(3600) },
      });
      await expect(
        opaqueLoginFinish("x", new Uint8Array(), LOGIN),
      ).rejects.toBeInstanceOf(MissingIdError);
    });
  });
});
