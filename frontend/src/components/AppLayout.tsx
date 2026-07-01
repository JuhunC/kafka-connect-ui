// AppLayout: top bar (product name, cluster switcher, user + roles, sign-out)
// and a tabbed body ("Topology" / "Connectors").

import { type ReactElement, type ReactNode } from "react";
import {
  AppBar,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import LensBlurIcon from "@mui/icons-material/LensBlur";
import IconButton from "@mui/material/IconButton";
import { useCurrentUser } from "../auth/useCurrentUser";
import { useAuthActions } from "../auth/useAuthActions";
import { useClusterContext } from "../pages/ClusterContext";

export type AppTab = "topology" | "connectors";

export interface AppLayoutProps {
  tab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: ReactNode;
}

export function AppLayout({ tab, onTabChange, children }: AppLayoutProps): ReactElement {
  const user = useCurrentUser();
  const { logout } = useAuthActions();
  const { clusters, selectedClusterId, selectCluster, streamStatus } = useClusterContext();

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <AppBar position="sticky" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2, flexWrap: "wrap" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <LensBlurIcon color="primary" />
            <Typography variant="h6" component="div" noWrap>
              ConnectLens
            </Typography>
          </Stack>

          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="cluster-switcher-label">Cluster</InputLabel>
            <Select
              labelId="cluster-switcher-label"
              label="Cluster"
              value={selectedClusterId ?? ""}
              onChange={(e) => selectCluster(e.target.value)}
              disabled={clusters.length === 0}
            >
              {clusters.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{c.name}</span>
                    {c.stale && (
                      <Chip size="small" color="warning" variant="outlined" label="stale" />
                    )}
                    {c.failedConnectors > 0 && (
                      <Chip
                        size="small"
                        color="error"
                        variant="outlined"
                        label={`${c.failedConnectors} failed`}
                      />
                    )}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <StreamIndicator status={streamStatus} />

          <Box sx={{ flexGrow: 1 }} />

          <Stack direction="row" spacing={1} alignItems="center">
            <Box textAlign="right">
              <Typography variant="body2" fontWeight={600} noWrap>
                {user.username || "…"}
              </Typography>
              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                {user.roles.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    no roles
                  </Typography>
                )}
                {user.roles.map((r) => (
                  <Chip key={r} size="small" variant="outlined" label={r} />
                ))}
              </Stack>
            </Box>
            <Tooltip title="Sign out">
              <IconButton onClick={logout} aria-label="Sign out">
                <LogoutIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>

        <Tabs
          value={tab}
          onChange={(_e, v: AppTab) => onTabChange(v)}
          sx={{ px: 2 }}
        >
          <Tab label="Topology" value="topology" />
          <Tab label="Connectors" value="connectors" />
        </Tabs>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, p: 2 }}>
        {children}
      </Box>
    </Box>
  );
}

function StreamIndicator({ status }: { status: string }): ReactElement {
  const map: Record<string, { color: "success" | "warning" | "error" | "default"; label: string }> = {
    open: { color: "success", label: "Live" },
    connecting: { color: "default", label: "Connecting" },
    polling: { color: "warning", label: "Polling" },
    error: { color: "error", label: "Offline" },
  };
  const d = map[status] ?? map.connecting;
  return <Chip size="small" color={d.color} variant="outlined" label={d.label} />;
}
