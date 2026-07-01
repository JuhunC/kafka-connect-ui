// Custom React Flow nodes for the topology graph: a central Kafka hub and
// external-system nodes (icon + label + HealthPill).

import { memo, type ReactElement } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import HubIcon from "@mui/icons-material/Hub";
import type { Health } from "../../api/types";
import { HealthPill } from "../HealthPill";
import { SystemKindIcon } from "../systemKind";

export interface KafkaNodeData extends Record<string, unknown> {
  label: string;
  sublabel: string | null;
  health: Health;
}

export interface ExternalNodeData extends Record<string, unknown> {
  label: string;
  sublabel: string | null;
  health: Health;
  systemKind: string | null;
  role: "source" | "sink" | "hub";
}

export type KafkaNode = Node<KafkaNodeData, "kafka">;
export type ExternalNode = Node<ExternalNodeData, "external">;
export type TopologyFlowNode = KafkaNode | ExternalNode;

function healthBorder(health: Health): string {
  switch (health) {
    case "RUNNING":
      return "success.main";
    case "DEGRADED":
    case "UNASSIGNED":
      return "warning.main";
    case "FAILED":
      return "error.main";
    default:
      return "divider";
  }
}

export const KafkaHubNode = memo(function KafkaHubNode({
  data,
}: NodeProps<KafkaNode>): ReactElement {
  return (
    <Paper
      elevation={4}
      sx={{
        px: 2,
        py: 1.5,
        minWidth: 150,
        textAlign: "center",
        borderRadius: 3,
        borderTop: 4,
        borderColor: "primary.main",
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Right} id="r-t" />
      <Handle type="source" position={Position.Left} id="l-s" />
      <Stack alignItems="center" spacing={0.5}>
        <HubIcon color="primary" />
        <Typography variant="subtitle1" fontWeight={700}>
          {data.label}
        </Typography>
        {data.sublabel && (
          <Typography variant="caption" color="text.secondary">
            {data.sublabel}
          </Typography>
        )}
      </Stack>
    </Paper>
  );
});

export const ExternalSystemNode = memo(function ExternalSystemNode({
  data,
}: NodeProps<ExternalNode>): ReactElement {
  return (
    <Paper
      elevation={2}
      sx={{
        px: 1.5,
        py: 1,
        minWidth: 160,
        maxWidth: 220,
        borderLeft: 4,
        borderColor: healthBorder(data.health),
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Handle type="target" position={Position.Right} id="r-t" />
      <Handle type="source" position={Position.Left} id="l-s" />
      <Stack direction="row" spacing={1} alignItems="center" mb={0.5}>
        <SystemKindIcon kind={data.systemKind} color="action" />
        <Box minWidth={0}>
          <Typography variant="subtitle2" noWrap title={data.label}>
            {data.label}
          </Typography>
          {data.sublabel && (
            <Typography variant="caption" color="text.secondary" noWrap display="block">
              {data.sublabel}
            </Typography>
          )}
        </Box>
      </Stack>
      <HealthPill health={data.health} />
    </Paper>
  );
});

export const nodeTypes = {
  kafka: KafkaHubNode,
  external: ExternalSystemNode,
};
