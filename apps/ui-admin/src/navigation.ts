/**
 * A console menu entry: where it goes (a route path relative to the
 * console's base, wherever the installation serves it), its icon and its
 * label.
 */
export interface AdminNavLink {
  to: string;
  icon: string;
  label: string;
}

/** The CE console's menu, in the order it is shown. */
export const consoleNav: AdminNavLink[] = [
  { to: "/", icon: "sym_o_dashboard", label: "Dashboard" },
  { to: "/applications", icon: "sym_o_apps", label: "Applications" },
  { to: "/users", icon: "sym_o_group", label: "Users" },
  {
    to: "/access-overview",
    icon: "sym_o_assignment_ind",
    label: "Access Overview",
  },
  {
    to: "/roles",
    icon: "sym_o_admin_panel_settings",
    label: "Roles & Permissions",
  },
  { to: "/profile-schema", icon: "sym_o_schema", label: "Profile Schema" },
  { to: "/groups", icon: "sym_o_workspaces", label: "Groups" },
  { to: "/sessions", icon: "sym_o_devices", label: "Sessions" },
  { to: "/devices", icon: "sym_o_phone_android", label: "Devices" },
  {
    to: "/identity-providers",
    icon: "sym_o_login",
    label: "Identity Providers",
  },
  {
    to: "/service-accounts",
    icon: "sym_o_smart_toy",
    label: "Service Accounts",
  },
  { to: "/flows", icon: "sym_o_account_tree", label: "Auth Flows" },
  { to: "/scopes", icon: "sym_o_verified_user", label: "Scopes & Claims" },
  { to: "/scim", icon: "sym_o_sync", label: "SCIM Provisioning" },
  { to: "/branding", icon: "sym_o_palette", label: "Branding" },
  { to: "/headless-api", icon: "sym_o_api", label: "Headless API" },
  {
    to: "/notification-templates",
    icon: "sym_o_mail",
    label: "Notification Templates",
  },
  { to: "/webhooks", icon: "sym_o_webhook", label: "Webhooks & Events" },
  { to: "/admin-roles", icon: "sym_o_shield_person", label: "Admin Roles" },
  { to: "/enrollment", icon: "sym_o_how_to_reg", label: "Enrollment Policy" },
  { to: "/security", icon: "sym_o_security", label: "Security Policies" },
  {
    to: "/migration",
    icon: "sym_o_move_down",
    label: "Blueprints & Migration",
  },
  {
    to: "/operations",
    icon: "sym_o_manufacturing",
    label: "Instance Operations",
  },
  { to: "/organization", icon: "sym_o_domain", label: "Organization" },
  { to: "/analytics", icon: "sym_o_analytics", label: "Analytics" },
  { to: "/events", icon: "sym_o_history", label: "Events & Audit" },
  { to: "/settings", icon: "sym_o_settings", label: "Settings" },
];
