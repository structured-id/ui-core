import { describe, expect, it } from "vitest";
import { adminRoutes, consolePages } from "./routes";
import { consoleNav } from "#admin/navigation";

describe("adminRoutes", () => {
  // An extended console adds its pages beside the CE pages under the same
  // layout, and its menu entries after the CE entries, instead of copying
  // the CE route table.
  it("adds extension pages and menu entries to the console", () => {
    const eePage = {
      path: "ldap",
      name: "admin-ldap",
      component: () => Promise.resolve({}),
    };
    const eeNav = { to: "/ldap", icon: "sym_o_lan", label: "LDAP" };

    const [layout] = adminRoutes({ pages: [eePage], nav: [eeNav] });

    // Relative to the console's base, wherever the installation serves it.
    expect(layout.path).toBe("/");
    expect(layout.children).toEqual([...consolePages, eePage]);
    expect(layout.meta?.nav).toEqual([...consoleNav, eeNav]);
  });

  // Without an extension the console is exactly the CE console.
  it("is the CE console without an extension", () => {
    const [layout] = adminRoutes();
    expect(layout.children).toEqual(consolePages);
    expect(layout.meta?.nav).toEqual(consoleNav);
  });

  // Regression: routes and menu entries carried `/admin`, so the console
  // could be served nowhere else. None names a placement now.
  it("names no placement in any route or menu entry", () => {
    const paths = [
      ...adminRoutes().map((r) => r.path),
      ...consolePages.map((r) => r.path),
      ...consoleNav.map((n) => n.to),
    ];
    // `/admin-roles` is a page, not the prefix.
    expect(paths.filter((p) => /^\/admin(\/|$)/.test(p))).toEqual([]);
  });
});

describe("consoleBase", () => {
  // The shell's <base href> the UI host writes from the installation's
  // console address decides the base; one build serves every placement.
  it.each([
    ["/admin/", "/admin/"],
    ["/console", "/console/"],
    ["https://admin.sid.example.com/", "/"],
  ])("reads %s as %s", async (href, expected) => {
    const base = document.createElement("base");
    base.setAttribute("href", href);
    document.head.append(base);
    const { consoleBase } = await import("#admin/base");
    expect(consoleBase()).toBe(expected);
    base.remove();
  });

  it("is the root without a <base>", async () => {
    const { consoleBase } = await import("#admin/base");
    expect(consoleBase()).toBe("/");
  });
});
