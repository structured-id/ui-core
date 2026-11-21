import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AdministratorClaim,
  EnrollmentMode,
  getEnrollmentPolicy,
  getInstanceStatus,
} from "./useEnrollmentApi";

const mockGetInstanceStatus = vi.fn();
const mockGetEnrollmentPolicy = vi.fn();

vi.mock("../../index", () => ({
  getTransport: vi.fn(),
}));

vi.mock("@structured-id/proto/sid/v1/admin/enrollment.client", () => ({
  // Called with `new`: a constructor mock must be a `function`, not an arrow.
  EnrollmentServiceClient: vi.fn().mockImplementation(function () {
    return {
      getInstanceStatus: mockGetInstanceStatus,
      getEnrollmentPolicy: mockGetEnrollmentPolicy,
    };
  }),
}));

describe("getInstanceStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The registration page asks before anyone signs in, so the call must
  // carry no credentials and return the server's answer as is.
  it("asks without credentials and returns the status", async () => {
    mockGetInstanceStatus.mockResolvedValue({
      response: { claim: AdministratorClaim.OPEN },
    });

    const status = await getInstanceStatus();

    expect(mockGetInstanceStatus).toHaveBeenCalledWith({});
    expect(status).toEqual({ claim: AdministratorClaim.OPEN });
  });

  it("propagates gRPC errors", async () => {
    mockGetInstanceStatus.mockRejectedValue(new Error("UNAVAILABLE"));
    await expect(getInstanceStatus()).rejects.toThrow("UNAVAILABLE");
  });
});

describe("getEnrollmentPolicy", () => {
  // The registration page reads whether it needs an invite before anyone
  // signs in; the answer is the server's, unchanged.
  it("asks without credentials and returns the policy", async () => {
    const policy = {
      mode: EnrollmentMode.INVITE_ONLY,
      allowedDomains: [],
      trackSource: false,
      modePinned: false,
    };
    mockGetEnrollmentPolicy.mockResolvedValue({ response: policy });

    expect(await getEnrollmentPolicy()).toEqual(policy);
    expect(mockGetEnrollmentPolicy).toHaveBeenCalledWith({});
  });
});
