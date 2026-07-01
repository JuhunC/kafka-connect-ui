// Topology tab: cluster health panel, the React Flow topology graph, and a
// side list of external-system cards. Selecting an edge/node/card opens the
// connector detail drawer (handled by the parent via onConnectorSelect).

import type { ReactElement } from "react";
import { Alert, Box, Paper, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useClusterContext } from "./ClusterContext";
import { ClusterPanel } from "../components/ClusterPanel";
import { TopologyView } from "../components/topology/TopologyView";
import { ExternalSystemCard } from "../components/ExternalSystemCard";

export interface TopologyPageProps {
  onConnectorSelect: (connectorName: string) => void;
}

export function TopologyPage({ onConnectorSelect }: TopologyPageProps): ReactElement {
  const { snapshot, streamError } = useClusterContext();

  if (!snapshot) {
    return (
      <Stack alignItems="center" sx={{ mt: 8 }} spacing={2}>
        {streamError ? (
          <Alert severity="warning">Waiting for cluster data… {streamError}</Alert>
        ) : (
          <Typography color="text.secondary">Loading cluster snapshot…</Typography>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {snapshot.stale && (
        <Alert severity="warning">
          Snapshot is stale — showing the last successful poll. Connect may be temporarily
          unreachable.
        </Alert>
      )}

      <ClusterPanel cluster={snapshot.cluster} stale={snapshot.stale} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper variant="outlined" sx={{ height: 560, overflow: "hidden" }}>
            <TopologyView
              topology={snapshot.topology}
              onConnectorSelect={onConnectorSelect}
            />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Typography variant="subtitle2" color="text.secondary" mb={1}>
            External systems ({snapshot.externalSystems.length})
          </Typography>
          <Stack spacing={1.5} sx={{ maxHeight: 560, overflow: "auto", pr: 0.5 }}>
            {snapshot.externalSystems.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No external systems inferred.
              </Typography>
            )}
            {snapshot.externalSystems.map((sys) => (
              <ExternalSystemCard
                key={sys.id}
                system={sys}
                onConnectorClick={onConnectorSelect}
              />
            ))}
          </Stack>
        </Grid>
      </Grid>

      <Box />
    </Stack>
  );
}
