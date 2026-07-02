// Provides a single ApiClient instance wired to the current OIDC access token.
// Kept separate from the auth module so components import the client via a hook.
//
// When auth is disabled (config.authEnabled === false) there is no token, so
// the provider supplies a null token provider and never touches react-oidc.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { config } from "../config";
import { ApiClient } from "./client";

const ApiContext = createContext<ApiClient | null>(null);

// Auth-enabled provider: reads the token lazily from the OIDC user.
function AuthedApiProvider({ children }: { children: ReactNode }): ReactNode {
  const auth = useAuth();

  const client = useMemo(
    () =>
      new ApiClient({
        // Read the token lazily on each request so renewed tokens are picked up.
        getToken: () => auth.user?.access_token,
      }),
    [auth.user?.access_token],
  );

  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

// Auth-disabled provider: no token, no react-oidc dependency.
function AnonymousApiProvider({ children }: { children: ReactNode }): ReactNode {
  const client = useMemo(() => new ApiClient({ getToken: () => null }), []);
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function ApiProvider({ children }: { children: ReactNode }): ReactNode {
  // config.authEnabled is a module constant, so the branch is stable for the
  // app's lifetime and never changes hook order.
  return config.authEnabled ? (
    <AuthedApiProvider>{children}</AuthedApiProvider>
  ) : (
    <AnonymousApiProvider>{children}</AnonymousApiProvider>
  );
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error("useApi must be used within an <ApiProvider>");
  }
  return client;
}
