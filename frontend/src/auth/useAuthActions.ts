// login / logout helpers over react-oidc-context. logout revokes the local
// session and redirects to the IdP end-session endpoint.

import { useCallback } from "react";
import { useAuth } from "react-oidc-context";

export interface AuthActions {
  login: () => void;
  logout: () => void;
}

export function useAuthActions(): AuthActions {
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
