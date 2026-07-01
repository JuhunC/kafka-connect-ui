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
import { Box, useTheme } from "@mui/material";
import type { Theme } from "@mui/material/styles";
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

/** Radial layout: hub in the centre, externals arranged left (source) / right (sink). */
function layout(topology: TopologyDto): {
  nodes: TopologyFlowNode[];
  hubId: string | null;
} {
  const hub = topology.nodes.find((n) => n.kind === "kafka");
  const externals = topology.nodes.filter((n) => n.kind === "external");

  const centerX = 480;
  const centerY = 40 + Math.max(externals.length - 1, 0) * 60;

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
    // direction "in": source(external) → kafka  → external on the LEFT
    // direction "out": kafka → target(external) → external on the RIGHT
    const externalId = e.direction === "in" ? e.source : e.target;
    sideOf.set(externalId, e.direction === "in" ? "left" : "right");
  }

  const leftNodes = externals.filter((n) => (sideOf.get(n.id) ?? "left") === "left");
  const rightNodes = externals.filter((n) => sideOf.get(n.id) === "right");

  const place = (arr: typeof externals, side: "left" | "right") => {
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
  place(leftNodes, "left");
  place(rightNodes, "right");

  return { nodes, hubId: hub?.id ?? null };
}

export interface TopologyViewProps {
  topology: TopologyDto;
  onConnectorSelect: (connectorName: string) => void;
}

function TopologyInner({ topology, onConnectorSelect }: TopologyViewProps): ReactElement {
  const theme = useTheme();
  const reducedMotion = prefersReducedMotion();

  const built = useMemo(() => layout(topology), [topology]);

  const flowEdges: Edge[] = useMemo(
    () =>
      topology.edges.map((e) => {
        const color = edgeColor(theme, e.health);
        const running = e.health === "RUNNING";
        // Attach the appropriate handles for left- vs right-side externals.
        const isOut = e.direction === "out";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: isOut ? undefined : "l-s",
          targetHandle: isOut ? undefined : "r-t",
          label: e.connectorName,
          animated: running && !reducedMotion,
          style: { stroke: color, strokeWidth: 2 },
          labelStyle: { fill: theme.palette.text.primary, fontSize: 11 },
          labelBgStyle: { fill: theme.palette.background.paper, opacity: 0.85 },
          data: { connectorName: e.connectorName },
        } satisfies Edge;
      }),
    [topology.edges, theme, reducedMotion],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<TopologyFlowNode>(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(flowEdges);

  // Keep the flow in sync when a new snapshot arrives.
  useEffect(() => setNodes(built.nodes), [built.nodes, setNodes]);
  useEffect(() => setEdges(flowEdges), [flowEdges, setEdges]);

  const edgeByTarget = useMemo(() => {
    // For a node click, find any connector attached to it.
    const map = new Map<string, string>();
    for (const e of topology.edges) {
      map.set(e.source, e.connectorName);
      map.set(e.target, e.connectorName);
    }
    return map;
  }, [topology.edges]);

  const onEdgeClick: EdgeMouseHandler<Edge> = useCallback(
    (_evt, edge) => {
      const name = (edge.data as { connectorName?: string } | undefined)?.connectorName;
      if (name) onConnectorSelect(name);
    },
    [onConnectorSelect],
  );

  const onNodeClick: NodeMouseHandler<TopologyFlowNode> = useCallback(
    (_evt, node) => {
      if (node.type === "kafka") return;
      const name = edgeByTarget.get(node.id);
      if (name) onConnectorSelect(name);
    },
    [edgeByTarget, onConnectorSelect],
  );

  return (
    <Box sx={{ height: "100%", width: "100%", minHeight: 480 }}>
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
    </Box>
  );
}

export function TopologyView(props: TopologyViewProps): ReactElement {
  return (
    <ReactFlowProvider>
      <TopologyInner {...props} />
    </ReactFlowProvider>
  );
}
