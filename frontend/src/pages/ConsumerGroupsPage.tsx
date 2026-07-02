// Consumer Groups tab: a DataGrid of the cluster's Kafka consumer groups
// (distinct from Connect connectors). Reads the live snapshot so it updates as
// SSE frames arrive. A row click asks the parent to open the shared detail
// drawer (the same drawer the topology graph opens), so there's a single,
// consistent consumer-group detail overlay across the app.

import { useMemo, type ReactElement } from "react";
import { Alert, Box, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { useClusterContext } from "./ClusterContext";
import { HealthPill } from "../components/HealthPill";
import type { ConsumerGroupDto } from "../api/types";

interface Row {
  id: string; // groupId (unique)
  groupId: string;
  state: string;
  health: ConsumerGroupDto["health"];
  memberCount: number;
  topicsCount: number;
  topics: string[];
  totalLag: number | null;
}

export interface ConsumerGroupsPageProps {
  /** Open the shared consumer-group detail drawer for this group id. */
  onConsumerSelect: (groupId: string) => void;
}

export function ConsumerGroupsPage({ onConsumerSelect }: ConsumerGroupsPageProps): ReactElement {
  const { snapshot } = useClusterContext();

  const groups = snapshot?.consumerGroups ?? [];

  const rows: Row[] = useMemo(
    () =>
      groups.map((g) => ({
        id: g.groupId,
        groupId: g.groupId,
        state: g.state,
        health: g.health,
        memberCount: g.memberCount,
        topicsCount: g.topics.length,
        topics: g.topics,
        totalLag: g.totalLag,
      })),
    [groups],
  );

  const columns: GridColDef<Row>[] = useMemo(
    () => [
      { field: "groupId", headerName: "Group ID", flex: 1.6, minWidth: 200 },
      {
        field: "health",
        headerName: "State",
        width: 220,
        sortable: true,
        renderCell: (params: GridRenderCellParams<Row, Row["health"]>) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <HealthPill health={params.value} />
            <Typography variant="caption" color="text.secondary">
              {params.row.state}
            </Typography>
          </Stack>
        ),
      },
      { field: "memberCount", headerName: "Members", width: 110, type: "number" },
      {
        field: "topicsCount",
        headerName: "Topics",
        width: 100,
        type: "number",
        renderCell: (params: GridRenderCellParams<Row, number>) => (
          <Tooltip
            title={params.row.topics.length > 0 ? params.row.topics.join(", ") : "No topics"}
          >
            <span>{params.value}</span>
          </Tooltip>
        ),
      },
      {
        field: "totalLag",
        headerName: "Total lag",
        width: 130,
        type: "number",
        valueFormatter: (value: number | null) =>
          value == null ? "—" : value.toLocaleString(),
      },
    ],
    [],
  );

  if (!snapshot) {
    return (
      <Stack alignItems="center" sx={{ mt: 8 }}>
        <Typography color="text.secondary">Loading consumer groups…</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {snapshot.stale && (
        <Alert severity="warning">Snapshot is stale — showing the last successful poll.</Alert>
      )}
      <Paper variant="outlined" sx={{ p: 1 }}>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No consumer groups. Connect-owned sink groups are shown as connectors instead.
          </Typography>
        ) : (
          <Box sx={{ width: "100%" }}>
            <DataGrid
              rows={rows}
              columns={columns}
              autoHeight
              density="compact"
              disableRowSelectionOnClick
              onRowClick={(params) => onConsumerSelect(String(params.id))}
              initialState={{
                pagination: { paginationModel: { pageSize: 25, page: 0 } },
                sorting: { sortModel: [{ field: "health", sort: "asc" }] },
              }}
              pageSizeOptions={[10, 25, 50, 100]}
              sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
            />
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
