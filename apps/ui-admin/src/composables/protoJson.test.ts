import { describe, expect, it } from "vitest";
import { Event } from "@structured-id/proto/sid/v1/admin/events";
import { prettyJson } from "./protoJson";

describe("prettyJson", () => {
  // Regression: a timestamped record's details went through JSON.stringify,
  // which throws on the bigint seconds, so the details dialog never opened.
  it("shows a message with a timestamp in its protobuf JSON form", () => {
    const event = Event.create({
      timestamp: { seconds: 1_700_000_000n, nanos: 0 },
    });

    const shown = JSON.parse(prettyJson(Event, event));

    expect(shown.timestamp).toBe("2023-11-14T22:13:20Z");
  });
});
