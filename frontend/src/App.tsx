// App: wires QueryClientProvider + AuthProvider (OIDC) + theme + the API and
// cluster providers, then gates the dashboard behind authentication.

import { useMemo, type ReactElement } from "react";
import { AuthProvider } from "react-oidc-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CssBaseline, ThemeProvider } from "@mui/material";
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

export function App(): ReactElement {
  const theme = useMemo(() => buildTheme(prefersDark() ? "dark" : "light"), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
    </ThemeProvider>
  );
}
