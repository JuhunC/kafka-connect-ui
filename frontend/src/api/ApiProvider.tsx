// Provides a single ApiClient instance wired to the current OIDC access token.
// Kept separate from the auth module so components import the client via a hook.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import { ApiClient } from "./client";

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ children }: { children: ReactNode }): ReactNode {
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

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) {
    throw new Error("useApi must be used within an <ApiProvider>");
  }
  return client;
}
