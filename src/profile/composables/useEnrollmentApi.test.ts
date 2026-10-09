import { describe, it, expect, vi, beforeEach } from "vitest";
import { getInstanceStatus } from "./useEnrollmentApi";

const mockGetInstanceStatus = vi.fn();

vi.mock("../../index", () => ({
  getTransport: vi.fn(),
}));

vi.mock("@structured-id/proto/sid/v1/admin/enrollment.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  EnrollmentServiceClient: vi.fn().mockImplementation(function () {
    return { getInstanceStatus: mockGetInstanceStatus };
  }),
}));

describe("getInstanceStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The registration page asks before anyone signs in, so the call must
  // carry no credentials and return the server's answer as is.
  it("asks without credentials and returns the status", async () => {
    mockGetInstanceStatus.mockResolvedValue({ response: { claimed: false } });

    const status = await getInstanceStatus();

    expect(mockGetInstanceStatus).toHaveBeenCalledWith({});
    expect(status).toEqual({ claimed: false });
  });

  it("propagates gRPC errors", async () => {
    mockGetInstanceStatus.mockRejectedValue(new Error("UNAVAILABLE"));
    await expect(getInstanceStatus()).rejects.toThrow("UNAVAILABLE");
  });
});
