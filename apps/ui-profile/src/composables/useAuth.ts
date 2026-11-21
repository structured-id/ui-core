import { loadZkppClient } from "@structured-id/opaque";
import { createAuth } from "@structured-id/ui-core/profile";

/**
 * The password ceremonies on the public password client: one instance per
 * page load, so the client loads once and is reused by each operation.
 */
let ceremonies: ReturnType<typeof createAuth> | undefined;

export function useAuth() {
  ceremonies ??= createAuth(() => loadZkppClient());
  return ceremonies;
}
