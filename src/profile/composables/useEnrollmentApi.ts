/**
 * Profile enrollment API composable.
 *
 * Wraps the public EnrollmentServiceClient calls the registration page makes
 * before anyone signs in.
 */
import { getTransport } from "../../index";
import { EnrollmentServiceClient } from "@structured-id/proto/sid/v1/admin/enrollment.client";
import type { InstanceStatus } from "@structured-id/proto/sid/v1/admin/enrollment";

function client(): EnrollmentServiceClient {
  return new EnrollmentServiceClient(getTransport());
}

export type { InstanceStatus };

/**
 * Whether the installation has its first administrator. While it has none,
 * registration accepts only the claim token from the service log.
 */
export async function getInstanceStatus(): Promise<InstanceStatus> {
  const { response } = await client().getInstanceStatus({});
  return response;
}
