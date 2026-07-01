// Role helpers. Roles are normalised to upper case so callers can pass
// "OPERATOR"/"ADMIN"/"VIEWER" regardless of the source casing.

export type AppRole = "VIEWER" | "OPERATOR" | "ADMIN";

interface RealmAccess {
  roles?: string[];
}

interface AccessTokenClaims {
  realm_access?: RealmAccess;
  preferred_username?: string;
  [key: string]: unknown;
}

/** Decode the payload of a JWT without verifying the signature (display only). */
export function decodeJwt(token: string): AccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(payload)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}

/** Extract realm roles from an access token (fallback when /api/me is absent). */
export function rolesFromAccessToken(accessToken: string | undefined): string[] {
  if (!accessToken) return [];
  const claims = decodeJwt(accessToken);
  return claims?.realm_access?.roles ?? [];
}

export function normalizeRoles(roles: readonly string[]): string[] {
  return roles.map((r) => r.toUpperCase());
}

export function hasRole(roles: readonly string[], role: AppRole): boolean {
  return normalizeRoles(roles).includes(role);
}

/** Operators and admins may perform mutating connector actions. */
export function canOperate(roles: readonly string[]): boolean {
  const upper = normalizeRoles(roles);
  return upper.includes("OPERATOR") || upper.includes("ADMIN");
}
