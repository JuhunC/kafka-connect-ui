// TopologyView: React Flow graph built from snapshot.topology. Kafka hub is
// laid out in the center with external systems radiating around it. Edges are
// colored by health and animated for running edges (unless reduced-motion).
// Clicking an external node or an edge opens the connector detail drawer.

import { useCallback, useEffect, useMemo, type ReactElement } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Box, Paper, Stack, Typography, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import HubIcon from "@mui/icons-material/Hub";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
import type { Health, TopologyDto } from "../../api/types";
import { nodeTypes, type TopologyFlowNode } from "./nodes";

function edgeColor(theme: Theme, health: Health): string {
  switch (health) {
    case "RUNNING":
      return theme.palette.success.main;
    case "DEGRADED":
    case "UNASSIGNED":
      return theme.palette.warning.main;
    case "FAILED":
      return theme.palette.error.main;
    case "PAUSED":
    case "STOPPED":
      return theme.palette.text.disabled;
    default:
      return theme.palette.grey[500];
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Radial layout: hub in the centre, externals arranged left (source) / right
 * (sink). Consumer-group nodes sit on the far right (consumer side, always
 * Kafka→group / direction "out").
 */
function layout(topology: TopologyDto): {
  nodes: TopologyFlowNode[];
  hubId: string | null;
} {
  const hub = topology.nodes.find((n) => n.kind === "kafka");
  const externals = topology.nodes.filter((n) => n.kind === "external");
  const consumers = topology.nodes.filter((n) => n.kind === "consumer");

  const rowCount = Math.max(externals.length, consumers.length);
  const centerX = 480;
  const centerY = 40 + Math.max(rowCount - 1, 0) * 60;

  const nodes: TopologyFlowNode[] = [];

  if (hub) {
    nodes.push({
      id: hub.id,
      type: "kafka",
      position: { x: centerX, y: centerY },
      data: { label: hub.label, sublabel: hub.sublabel, health: hub.health },
    });
  }

  // Determine which side each external sits on by the edge direction feeding it.
  const sideOf = new Map<string, "left" | "right">();
  for (const e of topology.edges) {
    if (e.kind !== "connector") continue;
    // direction "in": source(external) → kafka  → external on the LEFT
    // direction "out": kafka → target(external) → external on the RIGHT
    const externalId = e.direction === "in" ? e.source : e.target;
    sideOf.set(externalId, e.direction === "in" ? "left" : "right");
  }

  const leftNodes = externals.filter((n) => (sideOf.get(n.id) ?? "left") === "left");
  const rightNodes = externals.filter((n) => sideOf.get(n.id) === "right");

  const placeExternal = (arr: typeof externals, side: "left" | "right") => {
    const x = side === "left" ? centerX - 380 : centerX + 380;
    arr.forEach((n, i) => {
      nodes.push({
        id: n.id,
        type: "external",
        position: { x, y: i * 120 },
        data: {
          label: n.label,
          sublabel: n.sublabel,
          health: n.health,
          systemKind: n.systemKind,
          role: n.role,
        },
      });
    });
  };
  placeExternal(leftNodes, "left");
  placeExternal(rightNodes, "right");

  // Consumer groups on the consumer side, further right than sink externals.
  const consumerX = centerX + 760;
  consumers.forEach((n, i) => {
    nodes.push({
      id: n.id,
      type: "consumer",
      position: { x: consumerX, y: i * 120 },
      data: { label: n.label, sublabel: n.sublabel, health: n.health },
    });
  });

  return { nodes, hubId: hub?.id ?? null };
}

/** Per-edge data carried through React Flow so clicks can be routed by kind. */
interface EdgeData extends Record<string, unknown> {
  kind: "connector" | "consumer";
  connectorName: string | null;
  groupId: string | null;
}

export interface TopologyViewProps {
  topology: TopologyDto;
  onConnectorSelect: (connectorName: string) => void;
  onConsumerSelect?: (groupId: string) => void;
}

function TopologyInner({
  topology,
  onConnectorSelect,
  onConsumerSelect,
}: TopologyViewProps): ReactElement {
  const theme = useTheme();
  const reducedMotion = prefersReducedMotion();

  const built = useMemo(() => layout(topology), [topology]);

  const flowEdges: Edge[] = useMemo(
    () =>
      topology.edges.map((e) => {
        const color = edgeColor(theme, e.health);
        const running = e.health === "RUNNING";
        const isConsumer = e.kind === "consumer";
        // Attach the appropriate handles for left- vs right-side externals.
        const isOut = e.direction === "out";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: isOut ? undefined : "l-s",
          targetHandle: isOut ? undefined : "r-t",
          label: e.label,
          animated: running && !reducedMotion,
          // Consumer edges are visually distinct: dashed line tinted with the
          // secondary palette, so they read differently from connector edges.
          style: isConsumer
            ? {
                stroke: theme.palette.secondary.main,
                strokeWidth: 2,
                strokeDasharray: "6 4",
              }
            : { stroke: color, strokeWidth: 2 },
          labelStyle: {
            fill: isConsumer ? theme.palette.secondary.main : theme.palette.text.primary,
            fontSize: 11,
          },
          labelBgStyle: { fill: theme.palette.background.paper, opacity: 0.85 },
          data: {
            kind: e.kind,
            connectorName: e.connectorName,
            groupId: e.groupId,
          } satisfies EdgeData,
        } satisfies Edge;
      }),
    [topology.edges, theme, reducedMotion],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<TopologyFlowNode>(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flowEdges);

  // Keep the flow in sync when a new snapshot arrives.
  useEffect(() => setNodes(built.nodes), [built.nodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  const connectorByNode = useMemo(() => {
    // For a node click, find any connector attached to it.
    const map = new Map<string, string>();
    for (const e of topology.edges) {
      if (e.kind !== "connector" || !e.connectorName) continue;
      map.set(e.source, e.connectorName);
      map.set(e.target, e.connectorName);
    }
    return map;
  }, [topology.edges]);

  const onEdgeClick: EdgeMouseHandler<Edge> = useCallback(
    (_evt, edge) => {
      const data = edge.data as EdgeData | undefined;
      if (!data) return;
      if (data.kind === "consumer") {
        if (data.groupId) onConsumerSelect?.(data.groupId);
      } else if (data.connectorName) {
        onConnectorSelect(data.connectorName);
      }
    },
    [onConnectorSelect, onConsumerSelect],
  );

  const onNodeClick: NodeMouseHandler<TopologyFlowNode> = useCallback(
    (_evt, node) => {
      if (node.type === "kafka") return;
      if (node.type === "consumer") {
        // Consumer-group node id is "cg:"+groupId.
        const groupId = node.id.startsWith("cg:") ? node.id.slice(3) : node.id;
        onConsumerSelect?.(groupId);
        return;
      }
      const name = connectorByNode.get(node.id);
      if (name) onConnectorSelect(name);
    },
    [connectorByNode, onConnectorSelect, onConsumerSelect],
  );

  return (
    <Box sx={{ position: "relative", height: "100%", width: "100%", minHeight: 480 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        edgesFocusable
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
      <TopologyLegend />
    </Box>
  );
}

/** Legend explaining the three node kinds; consumer groups are called out as
 * distinct from connectors. */
function TopologyLegend(): ReactElement {
  return (
    <Paper
      elevation={3}
      sx={{
        position: "absolute",
        top: 8,
        right: 8,
        px: 1.5,
        py: 1,
        opacity: 0.95,
        zIndex: 5,
        pointerEvents: "none",
      }}
    >
      <Typography variant="caption" fontWeight={700} display="block" mb={0.5}>
        Legend
      </Typography>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HubIcon color="primary" fontSize="small" />
          <Typography variant="caption">Kafka cluster (hub)</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <DeviceHubIcon color="action" fontSize="small" />
          <Typography variant="caption">External system (via connector)</Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <GroupWorkIcon color="secondary" fontSize="small" />
          <Typography variant="caption">Consumer group (dashed edge)</Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}

export function TopologyView(props: TopologyViewProps): ReactElement {
  return (
    <ReactFlowProvider>
      <TopologyInner {...props} />
    </ReactFlowProvider>
  );
}
