import { defineRouter } from "#q-app";
import { createRouter, createWebHistory } from "vue-router";
import routes from "./routes";

export default defineRouter(function () {
  return createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    // The routes name their full paths (`/account/...`): the history starts
    // at the origin's root, never at the `<base href>` the UI host gives the
    // shell for its assets, which vue-router reads when given no base.
    history: createWebHistory("/"),
  });
});
