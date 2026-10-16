/**
 * Profile enrollment API composable.
 *
 * Wraps the public EnrollmentServiceClient calls the registration page makes
 * before anyone signs in.
 */
import { getTransport } from "../../index";
import { EnrollmentServiceClient } from "@structured-id/proto/sid/v1/admin/enrollment.client";
import {
  AdministratorClaim,
  type InstanceStatus,
} from "@structured-id/proto/sid/v1/admin/enrollment";

function client(): EnrollmentServiceClient {
  return new EnrollmentServiceClient(getTransport());
}

export { AdministratorClaim };
export type { InstanceStatus };

/**
 * The installation's local administrator claim (`claim`). While it is
 * `OPEN`, registration accepts only the claim token from the service log; a
 * centrally managed installation reports `UNAVAILABLE` and takes no token.
 */
export async function getInstanceStatus(): Promise<InstanceStatus> {
  const { response } = await client().getInstanceStatus({});
  return response;
}
