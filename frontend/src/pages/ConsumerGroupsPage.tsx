// Consumer Groups tab: a DataGrid of the cluster's Kafka consumer groups
// (distinct from Connect connectors). Reads the live snapshot so it updates as
// SSE frames arrive, matching how ConnectorsPage sources its data. A row click
// opens a small detail drawer with the full topics list + lag.

import { useEffect, useMemo, useState, type ReactElement } from "react";
import {
  Alert,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import GroupWorkIcon from "@mui/icons-material/GroupWork";
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
  /** When set, opens the detail drawer for this group id (e.g. from a topology click). */
  focusedGroupId?: string | null;
  /** Clears the focused group id once handled/closed. */
  onClearFocus?: () => void;
}

export function ConsumerGroupsPage({
  focusedGroupId,
  onClearFocus,
}: ConsumerGroupsPageProps): ReactElement {
  const { snapshot } = useClusterContext();
  const [selected, setSelected] = useState<string | null>(null);

  // Open the drawer when the topology (or another page) focuses a group.
  useEffect(() => {
    if (focusedGroupId) setSelected(focusedGroupId);
  }, [focusedGroupId]);

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

  const selectedGroup = useMemo(
    () => groups.find((g) => g.groupId === selected) ?? null,
    [groups, selected],
  );

  const closeDrawer = () => {
    setSelected(null);
    onClearFocus?.();
  };

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
              onRowClick={(params) => setSelected(String(params.id))}
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

      <ConsumerGroupDrawer group={selectedGroup} onClose={closeDrawer} />
    </Stack>
  );
}

function ConsumerGroupDrawer({
  group,
  onClose,
}: {
  group: ConsumerGroupDto | null;
  onClose: () => void;
}): ReactElement {
  return (
    <Drawer anchor="right" open={group !== null} onClose={onClose}>
      <Box sx={{ width: 380, p: 2 }} role="presentation">
        {group && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} alignItems="center">
              <GroupWorkIcon color="secondary" />
              <Typography variant="h6" sx={{ flexGrow: 1, wordBreak: "break-all" }}>
                {group.groupId}
              </Typography>
              <IconButton onClick={onClose} aria-label="Close">
                <CloseIcon />
              </IconButton>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <HealthPill health={group.health} />
              <Chip size="small" variant="outlined" label={group.state} />
            </Stack>

            <Divider />

            <Stack spacing={0.5}>
              <DetailRow label="Members" value={String(group.memberCount)} />
              <DetailRow
                label="Coordinator"
                value={group.coordinatorId == null ? "—" : String(group.coordinatorId)}
              />
              <DetailRow
                label="Total lag"
                value={group.totalLag == null ? "—" : group.totalLag.toLocaleString()}
              />
            </Stack>

            <Divider />

            <Typography variant="subtitle2">Topics ({group.topics.length})</Typography>
            {group.topics.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No committed topics.
              </Typography>
            ) : (
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {group.topics.map((t) => (
                  <Chip key={t} size="small" label={t} />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}

function DetailRow({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <Stack direction="row" justifyContent="space-between">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        {value}
      </Typography>
    </Stack>
  );
}
