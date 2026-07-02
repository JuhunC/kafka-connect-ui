// login / logout helpers over react-oidc-context. logout revokes the local
// session and redirects to the IdP end-session endpoint.
//
// When auth is disabled there is no OIDC session, so both actions are no-ops.

import { useCallback } from "react";
import { useAuth } from "react-oidc-context";
import { config } from "../config";

export interface AuthActions {
  login: () => void;
  logout: () => void;
}

const NOOP_ACTIONS: AuthActions = {
  login: () => {},
  logout: () => {},
};

function useOidcAuthActions(): AuthActions {
  const auth = useAuth();

  const login = useCallback(() => {
    void auth.signinRedirect();
  }, [auth]);

  const logout = useCallback(() => {
    // Clear the local user first, then hit the IdP end-session endpoint.
    void auth.removeUser().finally(() => {
      void auth.signoutRedirect();
    });
  }, [auth]);

  return { login, logout };
}

export function useAuthActions(): AuthActions {
  // config.authEnabled is a module constant, so the branch is stable and never
  // changes hook order for the app's lifetime.
  if (!config.authEnabled) {
    return NOOP_ACTIONS;
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useOidcAuthActions();
}
