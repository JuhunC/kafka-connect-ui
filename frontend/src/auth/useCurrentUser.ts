// Resolves the signed-in identity + roles. Prefers GET /api/me (authoritative,
// backend-normalised roles) and falls back to the access token's realm_access.
//
// When auth is disabled (config.authEnabled === false) there is no OIDC user.
// We still consult GET /api/me — the backend is the source of truth: in no-auth
// mode it returns local/ADMIN, so every action button is enabled regardless of
// the frontend's own build flag. We optimistically default to ADMIN so buttons
// aren't briefly disabled while /api/me loads (and stay usable if it can't be
// reached, matching the no-auth intent that the API is open).

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { config } from "../config";
import { useApi } from "../api/ApiProvider";
import type { MeDto } from "../api/types";
import { canOperate, hasRole, rolesFromAccessToken, type AppRole } from "./roles";

export interface CurrentUser {
  username: string;
  roles: string[];
  hasRole: (role: AppRole) => boolean;
  canOperate: boolean;
  isLoading: boolean;
}

// Optimistic no-auth identity used while /api/me loads or if it is unreachable.
const LOCAL_ADMIN_ROLES = ["ADMIN"];

// No-auth resolver: trust the backend's GET /api/me for roles rather than the
// frontend's build flag, so a stale/missing authEnabled can't disable actions
// while the backend is actually open. Defaults to ADMIN until /api/me answers.
function useAnonymousCurrentUser(): CurrentUser {
  const api = useApi();
  const meQuery = useQuery<MeDto>({
    queryKey: ["me", "anonymous"],
    queryFn: () => api.getMe(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const roles = meQuery.data?.roles ?? LOCAL_ADMIN_ROLES;
  const username = meQuery.data?.username ?? "local";

  return {
    username,
    roles,
    hasRole: (role) => hasRole(roles, role),
    canOperate: canOperate(roles),
    isLoading: false,
  };
}

// Auth-enabled resolver: OIDC user + /api/me. Kept as its own hook so it (and
// its useAuth() call) is only ever mounted on the auth-enabled path.
function useAuthedCurrentUser(): CurrentUser {
  const auth = useAuth();
  const api = useApi();
  const authenticated = auth.isAuthenticated;

  const meQuery = useQuery<MeDto>({
    queryKey: ["me"],
    queryFn: () => api.getMe(),
    enabled: authenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Fallback identity from the token while /api/me is loading or if it fails.
  const tokenRoles = rolesFromAccessToken(auth.user?.access_token);
  const tokenUsername =
    (auth.user?.profile.preferred_username as string | undefined) ??
    (auth.user?.profile.name as string | undefined) ??
    (auth.user?.profile.sub as string | undefined) ??
    "";

  const roles = meQuery.data?.roles ?? tokenRoles;
  const username = meQuery.data?.username ?? tokenUsername;

  return {
    username,
    roles,
    hasRole: (role) => hasRole(roles, role),
    canOperate: canOperate(roles),
    isLoading: authenticated && meQuery.isLoading,
  };
}

export function useCurrentUser(): CurrentUser {
  // config.authEnabled is a module constant, so the branch is stable and never
  // changes hook order for the app's lifetime.
  if (!config.authEnabled) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useAnonymousCurrentUser();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useAuthedCurrentUser();
}
