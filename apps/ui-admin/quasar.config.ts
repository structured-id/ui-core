import { defineConfig } from "#q-app";

export default defineConfig(() => {
  return {
    boot: ["auth", "grpc"],

    css: ["app.scss"],

    extras: ["material-symbols-outlined", "roboto-font"],

    build: {
      target: { browser: ["es2022"] },
      vueRouterMode: "history",
      // The console is served under /admin/; its routes carry that prefix
      // themselves, so the router's base stays the origin's root.
      publicPath: "/admin/",
      vueRouterBase: "/",
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
