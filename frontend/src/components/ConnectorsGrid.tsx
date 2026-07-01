// ConnectorsGrid: MUI X DataGrid (community) listing snapshot.connectors.
// Row click opens the detail drawer.

import { useMemo, type ReactElement } from "react";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import { Box } from "@mui/material";
import type { ConnectorDto, ExternalSystemDto } from "../api/types";
import { HealthPill } from "./HealthPill";
import { shortClass } from "./ConnectorDetailDrawer";

interface Row {
  id: string; // connector name (unique)
  name: string;
  type: ConnectorDto["type"];
  connectorClass: string;
  health: ConnectorDto["health"];
  failedTasks: number;
  totalTasks: number;
  topicsCount: number;
  externalSystem: string;
  totalLag: number | null;
}

export interface ConnectorsGridProps {
  connectors: ConnectorDto[];
  externalSystems: ExternalSystemDto[];
  onRowClick: (connectorName: string) => void;
}

export function ConnectorsGrid({
  connectors,
  externalSystems,
  onRowClick,
}: ConnectorsGridProps): ReactElement {
  const systemsById = useMemo(() => {
    const map = new Map<string, ExternalSystemDto>();
    for (const s of externalSystems) map.set(s.id, s);
    return map;
  }, [externalSystems]);

  const rows: Row[] = useMemo(
    () =>
      connectors.map((c) => ({
        id: c.name,
        name: c.name,
        type: c.type,
        connectorClass: shortClass(c.connectorClass),
        health: c.health,
        failedTasks: c.failedTasks,
        totalTasks: c.totalTasks,
        topicsCount: c.topics.length,
        externalSystem: c.externalSystemId
          ? systemsById.get(c.externalSystemId)?.displayName ?? c.externalSystemId
          : "—",
        totalLag: c.lag ? c.lag.totalLag : null,
      })),
    [connectors, systemsById],
  );

  const columns: GridColDef<Row>[] = useMemo(
    () => [
      { field: "name", headerName: "Name", flex: 1.4, minWidth: 180 },
      { field: "type", headerName: "Type", width: 90 },
      { field: "connectorClass", headerName: "Class", flex: 1, minWidth: 160 },
      {
        field: "health",
        headerName: "Health",
        width: 140,
        sortable: true,
        renderCell: (params: GridRenderCellParams<Row, Row["health"]>) => (
          <HealthPill health={params.value} />
        ),
      },
      {
        field: "tasks",
        headerName: "Tasks",
        width: 100,
        valueGetter: (_v, row) => `${row.failedTasks}/${row.totalTasks}`,
        renderCell: (params: GridRenderCellParams<Row>) => (
          <Box sx={{ color: params.row.failedTasks > 0 ? "error.main" : "text.primary" }}>
            {params.row.failedTasks} / {params.row.totalTasks}
          </Box>
        ),
      },
      { field: "topicsCount", headerName: "Topics", width: 90, type: "number" },
      { field: "externalSystem", headerName: "External system", flex: 1, minWidth: 150 },
      {
        field: "totalLag",
        headerName: "Lag (sink)",
        width: 120,
        type: "number",
        valueFormatter: (value: number | null) =>
          value == null ? "—" : value.toLocaleString(),
      },
    ],
    [],
  );

  return (
    <Box sx={{ width: "100%" }}>
      <DataGrid
        rows={rows}
        columns={columns}
        autoHeight
        density="compact"
        disableRowSelectionOnClick
        onRowClick={(params) => onRowClick(String(params.id))}
        initialState={{
          pagination: { paginationModel: { pageSize: 25, page: 0 } },
          sorting: { sortModel: [{ field: "health", sort: "asc" }] },
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
      />
    </Box>
  );
}
