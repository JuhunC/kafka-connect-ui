// ClusterPanel: broker/topic/partition health for a cluster snapshot.
// Danger metrics (under-replicated, offline) turn red when > 0;
// activeControllerCount warns when != 1.

import type { ReactElement, ReactNode } from "react";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import type { ClusterHealthDto } from "../api/types";
import { HealthPill } from "./HealthPill";

interface MetricProps {
  label: string;
  value: ReactNode;
  danger?: boolean;
  warn?: boolean;
}

function Metric({ label, value, danger, warn }: MetricProps): ReactElement {
  const color = danger ? "error.main" : warn ? "warning.main" : "text.primary";
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" sx={{ color }}>
        {value}
      </Typography>
    </Box>
  );
}

export interface ClusterPanelProps {
  cluster: ClusterHealthDto;
  stale?: boolean;
}

export function ClusterPanel({ cluster, stale }: ClusterPanelProps): ReactElement {
  const underReplicated = cluster.underReplicatedPartitions;
  const offline = cluster.offlinePartitions;
  const controllerOk = cluster.activeControllerCount === 1;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          flexWrap="wrap"
          gap={1}
          mb={2}
        >
          <Typography variant="h6">Cluster health</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {stale && <Chip size="small" color="warning" label="Stale" variant="outlined" />}
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Kafka
              </Typography>
              <HealthPill
                reachability={cluster.kafkaReachable ? "REACHABLE" : "UNREACHABLE"}
              />
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Typography variant="caption" color="text.secondary">
                Connect
              </Typography>
              <HealthPill
                reachability={cluster.connectReachable ? "REACHABLE" : "UNREACHABLE"}
              />
            </Stack>
          </Stack>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            {/* AdminClient only reports live brokers, so brokersUp always equals
                brokersTotal — a "up / total" ratio can never flag a down broker.
                Show the live count; the real outage signals are the
                under-replicated / offline-partition metrics below. */}
            <Metric label="Brokers online" value={cluster.brokersUp} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Metric label="Topics" value={cluster.topicCount} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Metric label="Partitions" value={cluster.partitionCount} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Metric
              label="Under-replicated"
              value={underReplicated}
              danger={underReplicated > 0}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Metric label="Offline partitions" value={offline} danger={offline > 0} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Metric
              label="Active controllers"
              value={cluster.activeControllerCount}
              warn={!controllerOk}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Metric label="Controller id" value={cluster.controllerId ?? "—"} />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 3 }}>
            <Metric label="Connect version" value={cluster.connectVersion ?? "—"} />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
