// Dashboard: the authenticated app shell. Owns the active tab + the selected
// connector for the detail drawer, and renders the correct page.

import { useState, type ReactElement } from "react";
import { Alert, Container } from "@mui/material";
import { AppLayout, type AppTab } from "../components/AppLayout";
import { TopologyPage } from "./TopologyPage";
import { ConnectorsPage } from "./ConnectorsPage";
import { ConnectorDetailDrawer } from "../components/ConnectorDetailDrawer";
import { useClusterContext } from "./ClusterContext";

export function Dashboard(): ReactElement {
  const [tab, setTab] = useState<AppTab>("topology");
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const { selectedClusterId, clusters, clustersLoading, clustersError } = useClusterContext();

  const openConnector = (name: string) => setSelectedConnector(name);
  const closeConnector = () => setSelectedConnector(null);

  return (
    <AppLayout tab={tab} onTabChange={setTab}>
      {Boolean(clustersError) && (
        <Container sx={{ mt: 2 }}>
          <Alert severity="error">
            Failed to load clusters:{" "}
            {clustersError instanceof Error ? clustersError.message : "unknown error"}
          </Alert>
        </Container>
      )}

      {!clustersError && !clustersLoading && clusters.length === 0 && (
        <Container sx={{ mt: 2 }}>
          <Alert severity="info">No clusters are configured.</Alert>
        </Container>
      )}

      {tab === "topology" && <TopologyPage onConnectorSelect={openConnector} />}
      {tab === "connectors" && <ConnectorsPage onConnectorSelect={openConnector} />}

      {selectedClusterId && (
        <ConnectorDetailDrawer
          clusterId={selectedClusterId}
          connectorName={selectedConnector}
          open={selectedConnector !== null}
          onClose={closeConnector}
        />
      )}
    </AppLayout>
  );
}
