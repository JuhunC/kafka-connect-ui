import { WebStorageStateStore } from "oidc-client-ts";
import type { AuthProviderProps } from "react-oidc-context";
import { config } from "../config";

// react-oidc-context config. Automatic silent renew keeps the access token
// fresh without a full redirect; roles are read from the token / /api/me.
export const oidcConfig: AuthProviderProps = {
  authority: config.oidc.authority,
  client_id: config.oidc.client_id,
  redirect_uri: config.oidc.redirect_uri,
  post_logout_redirect_uri: config.oidc.post_logout_redirect_uri,
  response_type: config.oidc.response_type,
  scope: config.oidc.scope,
  automaticSilentRenew: true,
  loadUserInfo: false,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Strip the ?code=&state= params from the URL after a successful login.
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  },
};
