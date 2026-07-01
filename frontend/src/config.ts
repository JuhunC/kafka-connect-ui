// Runtime configuration. Reads Vite env vars with defaults matching CONTRACT.md.
// The API base is same-origin ("") so all calls hit /api/... and nginx (prod)
// or the Vite dev proxy forwards them to the backend.

const env = import.meta.env;

export const config = {
  oidc: {
    authority:
      env.VITE_OIDC_AUTHORITY ?? "http://localhost:8081/realms/connectlens",
    client_id: env.VITE_OIDC_CLIENT_ID ?? "connectlens-frontend",
    // The SPA is served at its own origin; redirect back to it.
    redirect_uri: window.location.origin,
    post_logout_redirect_uri: window.location.origin,
    response_type: "code",
    scope: env.VITE_OIDC_SCOPE ?? "openid profile",
  },
  // Empty string = same-origin. Requests are built as `${apiBase}/api/...`.
  apiBase: env.VITE_API_BASE ?? "",
} as const;

export type AppConfig = typeof config;
