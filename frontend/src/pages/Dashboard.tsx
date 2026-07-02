// Dashboard: the authenticated app shell. Owns the active tab + the selected
// connector / consumer group for their detail drawers, and renders the correct page.

import { useMemo, useState, type ReactElement } from "react";
import { Alert, Container } from "@mui/material";
import { AppLayout, type AppTab } from "../components/AppLayout";
import { TopologyPage } from "./TopologyPage";
import { ConnectorsPage } from "./ConnectorsPage";
import { TopicsPage } from "./TopicsPage";
import { ConsumerGroupsPage } from "./ConsumerGroupsPage";
import { ConnectorDetailDrawer } from "../components/ConnectorDetailDrawer";
import { ConsumerGroupDetailDrawer } from "../components/ConsumerGroupDetailDrawer";
import { useClusterContext } from "./ClusterContext";

export function Dashboard(): ReactElement {
  const [tab, setTab] = useState<AppTab>("topology");
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { selectedClusterId, snapshot, clusters, clustersLoading, clustersError } =
    useClusterContext();

  const openConnector = (name: string) => setSelectedConnector(name);
  const closeConnector = () => setSelectedConnector(null);

  // Clicking a consumer group anywhere (incl. the topology graph) opens its detail
  // drawer as an overlay on the current tab — same UX as clicking a connector.
  const openConsumerGroup = (groupId: string) => setSelectedGroup(groupId);
  const closeConsumerGroup = () => setSelectedGroup(null);

  const consumerGroup = useMemo(
    () => snapshot?.consumerGroups.find((g) => g.groupId === selectedGroup) ?? null,
    [snapshot, selectedGroup],
  );

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

      {tab === "topology" && (
        <TopologyPage
          onConnectorSelect={openConnector}
          onConsumerSelect={openConsumerGroup}
        />
      )}
      {tab === "connectors" && <ConnectorsPage onConnectorSelect={openConnector} />}
      {tab === "topics" && <TopicsPage />}
      {tab === "consumer-groups" && (
        <ConsumerGroupsPage
          onConsumerSelect={openConsumerGroup}
        />
      )}

      {selectedClusterId && (
        <ConnectorDetailDrawer
          clusterId={selectedClusterId}
          connectorName={selectedConnector}
          open={selectedConnector !== null}
          onClose={closeConnector}
        />
      )}

      <ConsumerGroupDetailDrawer group={consumerGroup} onClose={closeConsumerGroup} />
    </AppLayout>
  );
}
