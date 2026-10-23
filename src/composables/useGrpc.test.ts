import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock modules BEFORE importing the module under test
// ---------------------------------------------------------------------------

vi.mock("@protobuf-ts/grpcweb-transport", () => ({
  // Constructor mocks are `function`s: they are called with `new`.
  GrpcWebFetchTransport: vi.fn().mockImplementation(function () {
    return { type: "grpc-web-transport" };
  }),
}));

// Import AFTER mocks
import { GrpcWebFetchTransport } from "@protobuf-ts/grpcweb-transport";
import { initGrpc, getTransport, closeTransport, useGrpc } from "./useGrpc";
import type { GrpcConfig } from "../types/auth";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useGrpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    closeTransport();
  });

  describe("initGrpc", () => {
    // The BFF session cookie rides on every call, so credentials are always
    // included; nothing else configures the transport.
    it("creates GrpcWebFetchTransport with baseUrl and credentials", () => {
      const config: GrpcConfig = { baseUrl: "https://api.sid.example.com" };
      initGrpc(config);

      expect(GrpcWebFetchTransport).toHaveBeenCalledWith({
        baseUrl: "https://api.sid.example.com",
        fetchInit: { credentials: "include" },
      });
    });
  });

  describe("getTransport", () => {
    it("throws before initGrpc is called", () => {
      expect(() => getTransport()).toThrow("gRPC transport not initialized");
    });

    it("returns transport after initGrpc", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      expect(getTransport()).toEqual({ type: "grpc-web-transport" });
    });
  });

  describe("useGrpc composable", () => {
    it("transport.value is null before initGrpc", () => {
      const { transport } = useGrpc();
      expect(transport.value).toBeNull();
    });

    it("transport.value is set when initGrpc was called before useGrpc", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      const { transport } = useGrpc();
      expect(transport.value).not.toBeNull();
    });

    it("returns getTransport and initGrpc functions", () => {
      const composable = useGrpc();
      expect(typeof composable.getTransport).toBe("function");
      expect(typeof composable.initGrpc).toBe("function");
    });
  });

  describe("closeTransport", () => {
    // After close, the transport is gone: a later call must initialize
    // again rather than reuse the old one.
    it("resets transport to null (getTransport throws after close)", () => {
      initGrpc({ baseUrl: "https://api.sid.example.com" });
      closeTransport();
      expect(() => getTransport()).toThrow("gRPC transport not initialized");
      expect(useGrpc().transport.value).toBeNull();
    });
  });
});
