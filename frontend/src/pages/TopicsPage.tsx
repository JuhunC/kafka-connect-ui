// Topics tab: a DataGrid of the cluster's Kafka topics with per-topic producer
// activity. Reads the live snapshot so it updates as SSE frames arrive, matching
// how ConnectorsPage / ConsumerGroupsPage source their data. The "Last produced"
// column is the point of the feature: a recent timestamp means producers are
// actively writing to that topic.

import { useMemo, type ReactElement } from "react";
import { Alert, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { useClusterContext } from "./ClusterContext";
import { HealthPill } from "../components/HealthPill";
import type { TopicDto } from "../api/types";

interface Row {
  id: string; // topic name (unique)
  name: string;
  partitions: number;
  endOffsetSum: number;
  lastMessageTs: number | null;
  state: TopicDto["state"];
  health: TopicDto["health"];
}

/** Human relative time from an epoch-millis timestamp, e.g. "12s ago", "3m ago". */
function relativeTime(ts: number | null): string {
  if (ts == null) return "never";
  const deltaMs = Date.now() - ts;
  if (deltaMs < 0) return "just now";
  const seconds = Math.floor(deltaMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** What each topic state means, shown as a legend + per-row tooltip. */
const STATE_HELP: Record<TopicDto["state"], string> = {
  ACTIVE: "A message was produced recently (within the active window) — producers are writing.",
  IDLE: "The topic has data, but nothing has been produced recently — the producer may have stopped.",
  EMPTY: "No messages have ever been produced to this topic.",
};

const STATE_LEGEND: { state: TopicDto["state"]; health: TopicDto["health"]; desc: string }[] = [
  { state: "ACTIVE", health: "RUNNING", desc: "producing (recent messages)" },
  { state: "IDLE", health: "DEGRADED", desc: "has data, none recently" },
  { state: "EMPTY", health: "PAUSED", desc: "no messages yet" },
];

export function TopicsPage(): ReactElement {
  const { snapshot } = useClusterContext();

  const topics = snapshot?.topics ?? [];

  const rows: Row[] = useMemo(
    () =>
      topics.map((t) => ({
        id: t.name,
        name: t.name,
        partitions: t.partitions,
        endOffsetSum: t.endOffsetSum,
        lastMessageTs: t.lastMessageTs,
        state: t.state,
        health: t.health,
      })),
    [topics],
  );

  const columns: GridColDef<Row>[] = useMemo(
    () => [
      { field: "name", headerName: "Topic", flex: 1.6, minWidth: 220 },
      { field: "partitions", headerName: "Partitions", width: 120, type: "number" },
      {
        field: "endOffsetSum",
        headerName: "Messages",
        width: 150,
        type: "number",
        valueFormatter: (value: number) => value.toLocaleString(),
      },
      {
        field: "lastMessageTs",
        headerName: "Last produced",
        flex: 1,
        minWidth: 170,
        type: "number",
        // Sort by the raw epoch-millis value; nulls (never produced) sort last.
        renderCell: (params: GridRenderCellParams<Row, number | null>) => {
          const ts = params.value ?? null;
          const title =
            ts == null ? "No messages produced yet" : new Date(ts).toLocaleString();
          return (
            <Tooltip title={title}>
              <Typography
                variant="body2"
                fontWeight={600}
                color={ts == null ? "text.secondary" : "text.primary"}
              >
                {relativeTime(ts)}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        field: "state",
        headerName: "State",
        width: 160,
        sortable: true,
        renderCell: (params: GridRenderCellParams<Row, Row["state"]>) => (
          <Tooltip title={params.value ? STATE_HELP[params.value] : ""}>
            <span>
              <HealthPill health={params.row.health} label={params.value} />
            </span>
          </Tooltip>
        ),
      },
    ],
    [],
  );

  if (!snapshot) {
    return (
      <Stack alignItems="center" sx={{ mt: 8 }}>
        <Typography color="text.secondary">Loading topics…</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {snapshot.stale && (
        <Alert severity="warning">Snapshot is stale — showing the last successful poll.</Alert>
      )}
      <Typography variant="body2" color="text.secondary">
        Shows the last time a message was produced to each topic — a recent time and a green
        ACTIVE pill mean producers are healthy and writing.
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
        {STATE_LEGEND.map((s) => (
          <Stack key={s.state} direction="row" spacing={0.75} alignItems="center">
            <HealthPill health={s.health} label={s.state} />
            <Typography variant="caption" color="text.secondary">
              {s.desc}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Paper variant="outlined" sx={{ p: 1 }}>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No topics. Internal topics (names starting with "_") are excluded.
          </Typography>
        ) : (
          <DataGrid
            rows={rows}
            columns={columns}
            autoHeight
            density="compact"
            disableRowSelectionOnClick
            initialState={{
              pagination: { paginationModel: { pageSize: 25, page: 0 } },
              // Most-recently-produced first; nulls (never) sort last.
              sorting: { sortModel: [{ field: "lastMessageTs", sort: "desc" }] },
            }}
            pageSizeOptions={[10, 25, 50, 100]}
          />
        )}
      </Paper>
    </Stack>
  );
}
