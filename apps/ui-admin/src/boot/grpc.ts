import { defineBoot } from "#q-app";
import { initGrpc } from "@structured-id/ui-core";

// The console's API is served on the origin that serves the console: by the
// installation it is embedded in, or by the UI host's browser adapter.
export default defineBoot(() => {
  initGrpc({ baseUrl: window.location.origin });
});
