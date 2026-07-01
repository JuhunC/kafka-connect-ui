// Resolves the signed-in identity + roles. Prefers GET /api/me (authoritative,
// backend-normalised roles) and falls back to the access token's realm_access.

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
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

export function useCurrentUser(): CurrentUser {
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
