// App: wires QueryClientProvider + AuthProvider (OIDC) + theme + the API and
// cluster providers, then gates the dashboard behind authentication.
//
// When auth is disabled (config.authEnabled === false) the OIDC AuthProvider
// and the AuthGuard login gate are not mounted — the dashboard renders directly
// and the ApiProvider issues unauthenticated requests.

import { useMemo, type ReactElement, type ReactNode } from "react";
import { AuthProvider } from "react-oidc-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { config } from "./config";
import { oidcConfig } from "./auth/oidcConfig";
import { AuthGuard } from "./auth/AuthGuard";
import { ApiProvider } from "./api/ApiProvider";
import { ClusterProvider } from "./pages/ClusterContext";
import { Dashboard } from "./pages/Dashboard";
import { buildTheme, prefersDark } from "./theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// The authenticated app shell: unchanged from before — OIDC provider, login
// gate, then the dashboard.
function AuthenticatedApp(): ReactElement {
  return (
    <AuthProvider {...oidcConfig}>
      <QueryClientProvider client={queryClient}>
        <ApiProvider>
          <AuthGuard>
            <ClusterProvider>
              <Dashboard />
            </ClusterProvider>
          </AuthGuard>
        </ApiProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

// The auth-disabled app shell: no OIDC provider, no login gate.
function AnonymousApp(): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider>
        <ClusterProvider>
          <Dashboard />
        </ClusterProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}

export function App(): ReactElement {
  const theme = useMemo(() => buildTheme(prefersDark() ? "dark" : "light"), []);

  const body: ReactNode = config.authEnabled ? <AuthenticatedApp /> : <AnonymousApp />;

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {body}
    </ThemeProvider>
  );
}
