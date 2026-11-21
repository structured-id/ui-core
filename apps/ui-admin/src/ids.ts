/**
 * Identity references as the console handles them: answers carry them as
 * binary wire messages, actions name them by typed identifier.
 */
import { formatUuid } from "@structured-id/ids";

/** The wire form of a typed identifier: its 16 UUIDv7 bytes. */
export interface WireId {
  value: Uint8Array;
}

/**
 * The UUID text of the answered reference `wire`, for display, row keys and
 * routes. It checks nothing, so a malformed reference still renders; an
 * action checks the reference as its kind before naming it.
 */
export function shown(wire: WireId | undefined): string {
  return wire ? formatUuid(wire.value) : "";
}

/** Whether the answered reference `wire` names `id`. */
export function names(
  wire: WireId | undefined,
  id: { toBytes(): Uint8Array },
): boolean {
  if (!wire) return false;
  const bytes = id.toBytes();
  return (
    wire.value.length === bytes.length &&
    wire.value.every((b, i) => b === bytes[i])
  );
}
