// Connectors tab: the DataGrid of all connectors in the current snapshot.

import type { ReactElement } from "react";
import { Alert, Paper, Stack, Typography } from "@mui/material";
import { useClusterContext } from "./ClusterContext";
import { ConnectorsGrid } from "../components/ConnectorsGrid";

export interface ConnectorsPageProps {
  onConnectorSelect: (connectorName: string) => void;
}

export function ConnectorsPage({ onConnectorSelect }: ConnectorsPageProps): ReactElement {
  const { snapshot } = useClusterContext();

  if (!snapshot) {
    return (
      <Stack alignItems="center" sx={{ mt: 8 }}>
        <Typography color="text.secondary">Loading connectors…</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {snapshot.stale && (
        <Alert severity="warning">Snapshot is stale — showing the last successful poll.</Alert>
      )}
      <Paper variant="outlined" sx={{ p: 1 }}>
        <ConnectorsGrid
          connectors={snapshot.connectors}
          externalSystems={snapshot.externalSystems}
          onRowClick={onConnectorSelect}
        />
      </Paper>
    </Stack>
  );
}
