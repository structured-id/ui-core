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
    const eeNav = { to: "/admin/ldap", icon: "sym_o_lan", label: "LDAP" };

    const [layout] = adminRoutes({ pages: [eePage], nav: [eeNav] });

    expect(layout.path).toBe("/admin");
    expect(layout.children).toEqual([...consolePages, eePage]);
    expect(layout.meta?.nav).toEqual([...consoleNav, eeNav]);
  });

  // Without an extension the console is exactly the CE console.
  it("is the CE console without an extension", () => {
    const [layout] = adminRoutes();
    expect(layout.children).toEqual(consolePages);
    expect(layout.meta?.nav).toEqual(consoleNav);
  });
});
