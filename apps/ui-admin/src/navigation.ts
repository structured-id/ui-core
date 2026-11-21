/** A console menu entry: where it goes, its icon and its label. */
export interface AdminNavLink {
  to: string;
  icon: string;
  label: string;
}

/** The CE console's menu, in the order it is shown. */
export const consoleNav: AdminNavLink[] = [
  { to: "/admin", icon: "sym_o_dashboard", label: "Dashboard" },
  { to: "/admin/applications", icon: "sym_o_apps", label: "Applications" },
  { to: "/admin/users", icon: "sym_o_group", label: "Users" },
  {
    to: "/admin/access-overview",
    icon: "sym_o_assignment_ind",
    label: "Access Overview",
  },
  {
    to: "/admin/roles",
    icon: "sym_o_admin_panel_settings",
    label: "Roles & Permissions",
  },
  {
    to: "/admin/profile-schema",
    icon: "sym_o_schema",
    label: "Profile Schema",
  },
  { to: "/admin/groups", icon: "sym_o_workspaces", label: "Groups" },
  { to: "/admin/sessions", icon: "sym_o_devices", label: "Sessions" },
  { to: "/admin/devices", icon: "sym_o_phone_android", label: "Devices" },
  {
    to: "/admin/identity-providers",
    icon: "sym_o_login",
    label: "Identity Providers",
  },
  {
    to: "/admin/service-accounts",
    icon: "sym_o_smart_toy",
    label: "Service Accounts",
  },
  { to: "/admin/flows", icon: "sym_o_account_tree", label: "Auth Flows" },
  {
    to: "/admin/scopes",
    icon: "sym_o_verified_user",
    label: "Scopes & Claims",
  },
  { to: "/admin/scim", icon: "sym_o_sync", label: "SCIM Provisioning" },
  { to: "/admin/branding", icon: "sym_o_palette", label: "Branding" },
  { to: "/admin/headless-api", icon: "sym_o_api", label: "Headless API" },
  {
    to: "/admin/notification-templates",
    icon: "sym_o_mail",
    label: "Notification Templates",
  },
  { to: "/admin/webhooks", icon: "sym_o_webhook", label: "Webhooks & Events" },
  {
    to: "/admin/admin-roles",
    icon: "sym_o_shield_person",
    label: "Admin Roles",
  },
  {
    to: "/admin/enrollment",
    icon: "sym_o_how_to_reg",
    label: "Enrollment Policy",
  },
  { to: "/admin/security", icon: "sym_o_security", label: "Security Policies" },
  {
    to: "/admin/migration",
    icon: "sym_o_move_down",
    label: "Blueprints & Migration",
  },
  {
    to: "/admin/operations",
    icon: "sym_o_manufacturing",
    label: "Instance Operations",
  },
  { to: "/admin/organization", icon: "sym_o_domain", label: "Organization" },
  { to: "/admin/analytics", icon: "sym_o_analytics", label: "Analytics" },
  { to: "/admin/events", icon: "sym_o_history", label: "Events & Audit" },
  { to: "/admin/settings", icon: "sym_o_settings", label: "Settings" },
];
