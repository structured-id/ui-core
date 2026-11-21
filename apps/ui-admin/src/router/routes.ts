import type { RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/admin",
    component: () => import("layouts/AdminLayout.vue"),
    children: [
      {
        path: "",
        name: "admin-dashboard",
        component: () => import("pages/admin/DashboardPage.vue"),
      },
      {
        path: "applications",
        name: "admin-applications",
        component: () => import("pages/admin/ApplicationsPage.vue"),
        meta: { title: "Applications" },
      },
      {
        path: "applications/create",
        name: "admin-application-create",
        component: () => import("pages/admin/ApplicationCreatePage.vue"),
        meta: { title: "Create Application" },
      },
      {
        path: "applications/:id",
        name: "admin-application-detail",
        component: () => import("pages/admin/ApplicationDetailPage.vue"),
        meta: { title: "Application Detail" },
      },
      {
        path: "users",
        name: "admin-users",
        component: () => import("pages/admin/UsersPage.vue"),
        meta: { title: "Users" },
      },
      {
        path: "users/:userId",
        name: "admin-user-detail",
        component: () => import("pages/admin/UserDetailPage.vue"),
        meta: { title: "User Detail" },
      },
      {
        path: "access-overview",
        name: "admin-access-overview",
        component: () => import("pages/admin/AccessOverviewPage.vue"),
        meta: { title: "Access Overview" },
      },
      {
        path: "roles",
        name: "admin-roles",
        component: () => import("pages/admin/RolesPage.vue"),
        meta: { title: "Roles & Permissions" },
      },
      {
        path: "roles/:roleId",
        name: "admin-role-detail",
        component: () => import("pages/admin/RoleDetailPage.vue"),
        meta: { title: "Role Detail" },
      },
      {
        path: "groups",
        name: "admin-groups",
        component: () => import("pages/admin/GroupsPage.vue"),
        meta: { title: "Groups" },
      },
      {
        path: "groups/:groupId",
        name: "admin-group-detail",
        component: () => import("pages/admin/GroupDetailPage.vue"),
        meta: { title: "Group Detail" },
      },
      {
        path: "sessions",
        name: "admin-sessions",
        component: () => import("pages/admin/SessionsPage.vue"),
        meta: { title: "Sessions" },
      },
      {
        path: "devices",
        name: "admin-devices",
        component: () => import("pages/admin/DevicesPage.vue"),
        meta: { title: "Devices" },
      },
      {
        path: "identity-providers",
        name: "admin-identity-providers",
        component: () => import("pages/admin/IdentityProvidersPage.vue"),
        meta: { title: "Identity Providers" },
      },
      {
        path: "identity-providers/:providerId",
        name: "admin-identity-provider-detail",
        component: () => import("pages/admin/IdentityProviderDetailPage.vue"),
        meta: { title: "Provider Detail" },
      },
      {
        path: "service-accounts",
        name: "admin-service-accounts",
        component: () => import("pages/admin/ServiceAccountsPage.vue"),
        meta: { title: "Service Accounts" },
      },
      {
        path: "service-accounts/:machineUserId",
        name: "admin-service-account-detail",
        component: () => import("pages/admin/ServiceAccountDetailPage.vue"),
        meta: { title: "Service Account Detail" },
      },
      {
        path: "settings",
        name: "admin-settings",
        component: () => import("pages/admin/SettingsPage.vue"),
        meta: { title: "Settings" },
      },
      {
        path: "flows",
        name: "admin-flows",
        component: () => import("pages/admin/FlowsPage.vue"),
        meta: { title: "Authentication Flows" },
      },
      {
        path: "flows/:flowId",
        name: "admin-flow-detail",
        component: () => import("pages/admin/FlowDetailPage.vue"),
        meta: { title: "Flow Detail" },
      },
      {
        path: "scopes",
        name: "admin-scopes",
        component: () => import("pages/admin/ScopesPage.vue"),
        meta: { title: "Scopes & Claims" },
      },
      {
        path: "scopes/:scopeId",
        name: "admin-scope-detail",
        component: () => import("pages/admin/ScopeDetailPage.vue"),
        meta: { title: "Scope Detail" },
      },
      {
        path: "scim",
        name: "admin-scim",
        component: () => import("pages/admin/ScimPage.vue"),
        meta: { title: "SCIM Provisioning" },
      },
      {
        path: "branding",
        name: "admin-branding",
        component: () => import("pages/admin/BrandingPage.vue"),
        meta: { title: "Branding Editor" },
      },
      {
        path: "notification-templates",
        name: "admin-notification-templates",
        component: () => import("pages/admin/NotificationTemplatesPage.vue"),
        meta: { title: "Notification Templates" },
      },
      {
        path: "webhooks",
        name: "admin-webhooks",
        component: () => import("pages/admin/WebhooksPage.vue"),
        meta: { title: "Webhooks & Events" },
      },
      {
        path: "admin-roles",
        name: "admin-admin-roles",
        component: () => import("pages/admin/AdminRolesPage.vue"),
        meta: { title: "Admin Roles & Delegation" },
      },
      {
        path: "security",
        name: "admin-security-policies",
        component: () => import("pages/admin/SecurityPoliciesPage.vue"),
        meta: { title: "Security Policies" },
      },
      {
        path: "enrollment",
        name: "admin-enrollment",
        component: () => import("pages/admin/EnrollmentPolicyPage.vue"),
        meta: { title: "Enrollment Policy" },
      },
      {
        path: "migration",
        name: "admin-migration",
        component: () => import("pages/admin/MigrationPage.vue"),
        meta: { title: "Blueprints & Migration" },
      },
      {
        path: "operations",
        name: "admin-operations",
        component: () => import("pages/admin/InstanceOperationsPage.vue"),
        meta: { title: "Instance Operations" },
      },
      {
        path: "profile-schema",
        name: "admin-profile-schema",
        component: () => import("pages/admin/ProfileSchemaPage.vue"),
        meta: { title: "User Profile Schema" },
      },
      {
        path: "organization",
        name: "admin-organization",
        component: () => import("pages/admin/OrganizationsPage.vue"),
        meta: { title: "Organization" },
      },
      {
        path: "analytics",
        name: "admin-analytics",
        component: () => import("pages/admin/AnalyticsDashboardPage.vue"),
        meta: { title: "Analytics" },
      },
      {
        path: "events",
        name: "admin-events",
        component: () => import("pages/admin/EventsPage.vue"),
        meta: { title: "Events & Audit" },
      },
      {
        path: "headless-api",
        name: "admin-headless-api",
        component: () => import("pages/admin/HeadlessApiPage.vue"),
        meta: { title: "Headless API Reference" },
      },
    ],
  },

  // Redirect root to /admin
  {
    path: "/",
    redirect: "/admin",
  },

  // 404
  {
    path: "/:catchAll(.*)*",
    name: "not-found",
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
