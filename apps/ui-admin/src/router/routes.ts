import type { RouteRecordRaw } from "vue-router";
import { consoleNav, type AdminNavLink } from "#admin/navigation";

type Page = () => Promise<unknown>;

/** A console page under `/admin`, by its path relative to the console. */
function page(path: string, name: string, component: Page, title?: string) {
  return {
    path,
    name,
    component,
    meta: title ? { title } : {},
  } as RouteRecordRaw;
}

/** The CE console's pages, relative to `/admin`. */
export const consolePages: RouteRecordRaw[] = [
  page(
    "",
    "admin-dashboard",
    () => import("#admin/pages/admin/DashboardPage.vue"),
  ),
  page(
    "applications",
    "admin-applications",
    () => import("#admin/pages/admin/ApplicationsPage.vue"),
    "Applications",
  ),
  page(
    "applications/create",
    "admin-application-create",
    () => import("#admin/pages/admin/ApplicationCreatePage.vue"),
    "Create Application",
  ),
  page(
    "applications/:id",
    "admin-application-detail",
    () => import("#admin/pages/admin/ApplicationDetailPage.vue"),
    "Application Detail",
  ),
  page(
    "users",
    "admin-users",
    () => import("#admin/pages/admin/UsersPage.vue"),
    "Users",
  ),
  page(
    "users/:userId",
    "admin-user-detail",
    () => import("#admin/pages/admin/UserDetailPage.vue"),
    "User Detail",
  ),
  page(
    "access-overview",
    "admin-access-overview",
    () => import("#admin/pages/admin/AccessOverviewPage.vue"),
    "Access Overview",
  ),
  page(
    "roles",
    "admin-roles",
    () => import("#admin/pages/admin/RolesPage.vue"),
    "Roles & Permissions",
  ),
  page(
    "roles/:roleId",
    "admin-role-detail",
    () => import("#admin/pages/admin/RoleDetailPage.vue"),
    "Role Detail",
  ),
  page(
    "groups",
    "admin-groups",
    () => import("#admin/pages/admin/GroupsPage.vue"),
    "Groups",
  ),
  page(
    "groups/:groupId",
    "admin-group-detail",
    () => import("#admin/pages/admin/GroupDetailPage.vue"),
    "Group Detail",
  ),
  page(
    "sessions",
    "admin-sessions",
    () => import("#admin/pages/admin/SessionsPage.vue"),
    "Sessions",
  ),
  page(
    "devices",
    "admin-devices",
    () => import("#admin/pages/admin/DevicesPage.vue"),
    "Devices",
  ),
  page(
    "identity-providers",
    "admin-identity-providers",
    () => import("#admin/pages/admin/IdentityProvidersPage.vue"),
    "Identity Providers",
  ),
  page(
    "identity-providers/:providerId",
    "admin-identity-provider-detail",
    () => import("#admin/pages/admin/IdentityProviderDetailPage.vue"),
    "Provider Detail",
  ),
  page(
    "service-accounts",
    "admin-service-accounts",
    () => import("#admin/pages/admin/ServiceAccountsPage.vue"),
    "Service Accounts",
  ),
  page(
    "service-accounts/:machineUserId",
    "admin-service-account-detail",
    () => import("#admin/pages/admin/ServiceAccountDetailPage.vue"),
    "Service Account Detail",
  ),
  page(
    "settings",
    "admin-settings",
    () => import("#admin/pages/admin/SettingsPage.vue"),
    "Settings",
  ),
  page(
    "flows",
    "admin-flows",
    () => import("#admin/pages/admin/FlowsPage.vue"),
    "Authentication Flows",
  ),
  page(
    "flows/:flowId",
    "admin-flow-detail",
    () => import("#admin/pages/admin/FlowDetailPage.vue"),
    "Flow Detail",
  ),
  page(
    "scopes",
    "admin-scopes",
    () => import("#admin/pages/admin/ScopesPage.vue"),
    "Scopes & Claims",
  ),
  page(
    "scopes/:scopeId",
    "admin-scope-detail",
    () => import("#admin/pages/admin/ScopeDetailPage.vue"),
    "Scope Detail",
  ),
  page(
    "scim",
    "admin-scim",
    () => import("#admin/pages/admin/ScimPage.vue"),
    "SCIM Provisioning",
  ),
  page(
    "branding",
    "admin-branding",
    () => import("#admin/pages/admin/BrandingPage.vue"),
    "Branding Editor",
  ),
  page(
    "notification-templates",
    "admin-notification-templates",
    () => import("#admin/pages/admin/NotificationTemplatesPage.vue"),
    "Notification Templates",
  ),
  page(
    "webhooks",
    "admin-webhooks",
    () => import("#admin/pages/admin/WebhooksPage.vue"),
    "Webhooks & Events",
  ),
  page(
    "admin-roles",
    "admin-admin-roles",
    () => import("#admin/pages/admin/AdminRolesPage.vue"),
    "Admin Roles & Delegation",
  ),
  page(
    "security",
    "admin-security-policies",
    () => import("#admin/pages/admin/SecurityPoliciesPage.vue"),
    "Security Policies",
  ),
  page(
    "enrollment",
    "admin-enrollment",
    () => import("#admin/pages/admin/EnrollmentPolicyPage.vue"),
    "Enrollment Policy",
  ),
  page(
    "migration",
    "admin-migration",
    () => import("#admin/pages/admin/MigrationPage.vue"),
    "Blueprints & Migration",
  ),
  page(
    "operations",
    "admin-operations",
    () => import("#admin/pages/admin/InstanceOperationsPage.vue"),
    "Instance Operations",
  ),
  page(
    "profile-schema",
    "admin-profile-schema",
    () => import("#admin/pages/admin/ProfileSchemaPage.vue"),
    "User Profile Schema",
  ),
  page(
    "organization",
    "admin-organization",
    () => import("#admin/pages/admin/OrganizationsPage.vue"),
    "Organization",
  ),
  page(
    "analytics",
    "admin-analytics",
    () => import("#admin/pages/admin/AnalyticsDashboardPage.vue"),
    "Analytics",
  ),
  page(
    "events",
    "admin-events",
    () => import("#admin/pages/admin/EventsPage.vue"),
    "Events & Audit",
  ),
  page(
    "headless-api",
    "admin-headless-api",
    () => import("#admin/pages/admin/HeadlessApiPage.vue"),
    "Headless API Reference",
  ),
];

/** What a composing application adds to the console. */
export interface ConsoleExtension {
  /** Pages relative to `/admin`, beside the CE pages. */
  pages?: RouteRecordRaw[];
  /** Menu entries after the CE entries. */
  nav?: AdminNavLink[];
}

/**
 * The console's routes: the CE pages and any `extension` pages under the
 * console layout at `/admin`, whose menu lists both, plus the root redirect
 * and the not-found page. An extended console (EE) builds its router from
 * this rather than copying the CE route table.
 */
export function adminRoutes(
  extension: ConsoleExtension = {},
): RouteRecordRaw[] {
  return [
    {
      path: "/admin",
      component: () => import("#admin/layouts/AdminLayout.vue"),
      meta: { nav: [...consoleNav, ...(extension.nav ?? [])] },
      children: [...consolePages, ...(extension.pages ?? [])],
    },
    { path: "/", redirect: "/admin" },
    {
      path: "/:catchAll(.*)*",
      name: "not-found",
      component: () => import("#admin/pages/ErrorNotFound.vue"),
    },
  ];
}

export default adminRoutes();
