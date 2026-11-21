import { defineRouter } from "#q-app";
import { createRouter, createWebHistory } from "vue-router";
import routes from "./routes";
import { consoleBase } from "#admin/base";

export default defineRouter(function () {
  return createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    // Routes are relative to wherever the installation serves the console.
    history: createWebHistory(consoleBase()),
  });
});
