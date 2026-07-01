// ExternalSystemCard: kind icon, endpoint, reachability, contributing
// connectors and health rollup for one ExternalSystemDto.

import type { ReactElement } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import type { ExternalSystemDto } from "../api/types";
import { HealthPill } from "./HealthPill";
import { SystemKindIcon } from "./systemKind";

export interface ExternalSystemCardProps {
  system: ExternalSystemDto;
  onConnectorClick?: (connectorName: string) => void;
}

export function ExternalSystemCard({
  system,
  onConnectorClick,
}: ExternalSystemCardProps): ReactElement {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" mb={1}>
          <SystemKindIcon kind={system.kind} fontSize="large" color="action" />
          <Box flexGrow={1} minWidth={0}>
            <Typography variant="subtitle1" noWrap title={system.displayName}>
              {system.displayName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {system.kind} · {system.role}
            </Typography>
          </Box>
          <HealthPill health={system.health} />
        </Stack>

        <Stack spacing={1}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Endpoint:
            </Typography>
            <Typography variant="body2" noWrap title={system.endpoint ?? undefined}>
              {system.endpoint ?? "—"}
            </Typography>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">
              Reachability:
            </Typography>
            <HealthPill reachability={system.reachability} />
          </Stack>

          {system.lastSuccessTs != null && (
            <Typography variant="caption" color="text.secondary">
              Last success: {new Date(system.lastSuccessTs).toLocaleString()}
            </Typography>
          )}

          <Box>
            <Typography variant="body2" color="text.secondary" mb={0.5}>
              Contributing connectors
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
              {system.contributingConnectors.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  None
                </Typography>
              )}
              {system.contributingConnectors.map((name) => (
                <Chip
                  key={name}
                  size="small"
                  label={name}
                  onClick={
                    onConnectorClick ? () => onConnectorClick(name) : undefined
                  }
                  clickable={Boolean(onConnectorClick)}
                />
              ))}
            </Stack>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Compact inline reference used inside topology nodes / snapshots. */
export function ExternalSystemSummary({ system }: { system: ExternalSystemDto }): ReactElement {
  return (
    <Link component="span" underline="none" color="inherit">
      {system.displayName}
    </Link>
  );
}
