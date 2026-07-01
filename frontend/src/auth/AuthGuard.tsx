// Gates the app behind authentication. Shows a Sign-in screen when logged out,
// a spinner during the OIDC handshake, and an error panel on auth failure.

import { type ReactNode } from "react";
import { useAuth } from "react-oidc-context";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Container,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";

function CenteredCard({ children }: { children: ReactNode }): ReactNode {
  return (
    <Container maxWidth="sm" sx={{ mt: 12 }}>
      <Paper elevation={2} sx={{ p: 4 }}>
        <Stack spacing={2} alignItems="center" textAlign="center">
          {children}
        </Stack>
      </Paper>
    </Container>
  );
}

export function AuthGuard({ children }: { children: ReactNode }): ReactNode {
  const auth = useAuth();

  if (auth.activeNavigator === "signinSilent" || auth.activeNavigator === "signinRedirect") {
    return (
      <CenteredCard>
        <CircularProgress />
        <Typography>Signing in…</Typography>
      </CenteredCard>
    );
  }

  if (auth.isLoading) {
    return (
      <CenteredCard>
        <CircularProgress />
        <Typography>Loading…</Typography>
      </CenteredCard>
    );
  }

  if (auth.error) {
    return (
      <CenteredCard>
        <Alert severity="error" sx={{ width: "100%" }}>
          Authentication error: {auth.error.message}
        </Alert>
        <Button variant="contained" onClick={() => void auth.signinRedirect()}>
          Try again
        </Button>
      </CenteredCard>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <CenteredCard>
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
          }}
        >
          <LockOutlinedIcon fontSize="large" />
        </Box>
        <Typography variant="h5" component="h1">
          ConnectLens
        </Typography>
        <Typography color="text.secondary">
          Sign in to view your Kafka Connect clusters.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => void auth.signinRedirect()}
        >
          Sign in
        </Button>
      </CenteredCard>
    );
  }

  return <>{children}</>;
}
