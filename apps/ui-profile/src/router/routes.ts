import type { RouteRecordRaw, RouteRecordSingleView } from "vue-router";

/** A public ceremony page: no account session needed. */
function ceremony(
  path: string,
  name: string,
  component: RouteRecordSingleView["component"],
): RouteRecordRaw {
  return { path, name, component, meta: { public: true } };
}

/**
 * The account pages. The ceremony pages are public: the issuer sends a
 * browser to `/account/login` and `/account/consent`, and mailed links open
 * `/account/verify` and `/account/reset/new`. The self-service pages need
 * the account session.
 */
const routes: RouteRecordRaw[] = [
  ceremony("/account/login", "login", () => import("pages/LoginPage.vue")),
  ceremony("/account/login/mfa", "mfa", () => import("pages/MfaPage.vue")),
  ceremony(
    "/account/register",
    "register",
    () => import("pages/RegisterPage.vue"),
  ),
  ceremony(
    "/account/consent",
    "consent",
    () => import("pages/ConsentPage.vue"),
  ),
  ceremony(
    "/account/verify",
    "verify",
    () => import("pages/MagicLinkPage.vue"),
  ),
  ceremony(
    "/account/reset",
    "reset",
    () => import("pages/ResetRequestPage.vue"),
  ),
  ceremony(
    "/account/reset/new",
    "reset-new",
    () => import("pages/ResetNewPage.vue"),
  ),
  {
    path: "/account",
    component: () => import("layouts/AccountLayout.vue"),
    children: [
      {
        path: "",
        name: "profile",
        component: () => import("pages/ProfilePage.vue"),
      },
      {
        path: "security",
        name: "security",
        component: () => import("pages/SecurityPage.vue"),
      },
      {
        path: "sessions",
        name: "sessions",
        component: () => import("pages/SessionsPage.vue"),
      },
      {
        path: "consents",
        name: "consents",
        component: () => import("pages/ConsentsPage.vue"),
      },
    ],
  },
  {
    path: "/:catchAll(.*)*",
    name: "not-found",
    meta: { public: true },
    component: () => import("pages/ErrorNotFound.vue"),
  },
];

export default routes;
