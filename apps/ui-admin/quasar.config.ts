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
      // One build for every placement the installation configures (`/admin`,
      // another prefix, an admin host's root): asset URLs are relative and
      // resolve against the `<base href>` the UI host writes into the shell,
      // and the router takes its base from there too (`consoleBase`).
      // Quasar accepts a relative publicPath with hash routing only, so the
      // relative base is Vite's own.
      // The shared components resolve the framework and Vue from this app
      // (see ui-profile).
      extendViteConf(viteConf) {
        viteConf.base = "./";
        viteConf.resolve = {
          ...viteConf.resolve,
          dedupe: ["quasar", "vue", "vue-router", "pinia"],
        };
      },
    },

    devServer: {
      port: 8086,
      open: false,
      // The password client runs threaded WebAssembly (shared memory), which
      // a browser gives only to a cross-origin-isolated page; the UI host
      // sends the same two headers.
      headers: {
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "credentialless",
      },
    },

    framework: {
      plugins: ["Notify", "Dialog", "Loading", "LocalStorage"],
      config: {
        notify: {
          position: "top-right",
          timeout: 3000,
        },
      },
    },
  };
});
