import type { IMessageType } from "@protobuf-ts/runtime";

/**
 * `message` as indented protobuf JSON (the canonical JSON mapping: 64-bit
 * integers as strings, timestamps as RFC 3339), for showing a record whole.
 * Plain `JSON.stringify` throws on the bigint fields generated messages hold.
 */
export function prettyJson<T extends object>(
  type: IMessageType<T>,
  message: T,
): string {
  return type.toJsonString(message, { prettySpaces: 2 });
}
