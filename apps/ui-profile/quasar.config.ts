import { defineConfig } from "#q-app";

export default defineConfig(() => {
  return {
    // The transports first: the session read in `auth` goes through them.
    boot: ["grpc", "auth"],

    css: ["app.scss"],

    extras: ["material-symbols-outlined", "roboto-font"],

    build: {
      target: { browser: ["es2022"] },
      vueRouterMode: "history",
      // The account pages are served under /account/; their routes carry
      // that prefix themselves (the issuer links to /account/login and
      // /account/consent), so the router's base stays the origin's root.
      publicPath: "/account/",
      vueRouterBase: "/",
      // The shared components live in the workspace root, where the
      // framework is only a peer: they resolve it, and Vue, from this app,
      // or the build ships a stub that fails at run time.
      extendViteConf(viteConf) {
        viteConf.resolve = {
          ...viteConf.resolve,
          dedupe: ["quasar", "vue", "vue-router", "pinia"],
        };
      },
    },

    devServer: {
      port: 8085,
      open: false,
      // The password client may run threaded WebAssembly (shared memory),
      // which a browser gives only to a cross-origin-isolated page; the UI
      // host sends the same two headers.
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "credentialless",
      },
    },

    framework: {
      // Quasar's own icons (a select's arrow, the table's pager) from the
      // Material Symbols font the app loads, not the Material Icons it
      // does not.
      iconSet: "material-symbols-outlined",
      plugins: ["Notify", "Dialog", "Loading"],
      config: {
        notify: {
          position: "top-right",
          timeout: 3000,
        },
      },
    },
  };
});
