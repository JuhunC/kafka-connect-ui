// Auth barrel: re-export the public surface. `useAuth` comes from
// react-oidc-context; login/logout are thin helpers over it.

export { useAuth } from "react-oidc-context";
export { oidcConfig } from "./oidcConfig";
export { AuthGuard } from "./AuthGuard";
export { useCurrentUser, type CurrentUser } from "./useCurrentUser";
export {
  hasRole,
  canOperate,
  rolesFromAccessToken,
  normalizeRoles,
  type AppRole,
} from "./roles";
export { useAuthActions } from "./useAuthActions";
