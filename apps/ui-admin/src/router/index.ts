import { defineRouter } from "#q-app";
import { createRouter, createWebHistory } from "vue-router";
import { reloadOnStaleChunk } from "@structured-id/ui-core";
import routes from "./routes";
import { consoleBase } from "#admin/base";

export default defineRouter(function () {
  const router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    // Routes are relative to wherever the installation serves the console.
    history: createWebHistory(consoleBase()),
  });
  reloadOnStaleChunk(router);
  return router;
});
