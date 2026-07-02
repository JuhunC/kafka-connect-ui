// Runtime configuration.
//
// Resolution priority (highest first):
//   1. window.__CONNECTLENS_CONFIG__ — injected at container start by
//      /docker-entrypoint.d/40-connectlens-config.sh writing /config.js, so a
//      single prebuilt image can be configured per-environment at run time.
//   2. import.meta.env (Vite VITE_* build-time env) — handy for local dev.
//   3. Hardcoded defaults matching CONTRACT.md.
//
// The API base is same-origin ("") by default so all calls hit /api/... and
// nginx (prod) or the Vite dev proxy forwards them to the backend.

const env = import.meta.env;

// The runtime-injected global. Present when /config.js has run (it always does
// in prod; public/config.js provides a safe empty default in dev / if absent).
const runtime = window.__CONNECTLENS_CONFIG__ ?? {};

// authEnabled: a real boolean from the window global wins; otherwise the Vite
// env (VITE_AUTH_ENABLED="false" disables), otherwise default to enabled.
const authEnabled: boolean =
  typeof runtime.authEnabled === "boolean"
    ? runtime.authEnabled
    : env.VITE_AUTH_ENABLED !== undefined
      ? env.VITE_AUTH_ENABLED !== "false"
      : true;

const authority: string =
  runtime.oidc?.authority ??
  env.VITE_OIDC_AUTHORITY ??
  "http://localhost:8081/realms/connectlens";

const clientId: string =
  runtime.oidc?.client_id ??
  env.VITE_OIDC_CLIENT_ID ??
  "connectlens-frontend";

const apiBase: string = runtime.apiBase ?? env.VITE_API_BASE ?? "";

export const config = {
  authEnabled,
  oidc: {
    authority,
    client_id: clientId,
    // The SPA is served at its own origin; redirect back to it.
    redirect_uri: window.location.origin,
    post_logout_redirect_uri: window.location.origin,
    response_type: "code" as const,
    scope: env.VITE_OIDC_SCOPE ?? "openid profile",
  },
  // Empty string = same-origin. Requests are built as `${apiBase}/api/...`.
  apiBase,
} as const;

export type AppConfig = typeof config;

declare global {
  interface Window {
    __CONNECTLENS_CONFIG__?: {
      authEnabled?: boolean;
      oidc?: {
        authority?: string;
        client_id?: string;
      };
      apiBase?: string;
    };
  }
}
