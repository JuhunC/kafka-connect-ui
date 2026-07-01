// Right-side drawer with full connector detail. Fetches getConnectorDetail on
// open, shows health, RBAC-gated actions, tasks, config, lag, and error traces.

import { useState, type ReactElement } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ReplayIcon from "@mui/icons-material/Replay";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "../api/ApiProvider";
import { useCurrentUser } from "../auth/useCurrentUser";
import type { ConnectorDetailDto } from "../api/types";
import { HealthPill } from "./HealthPill";
import { ErrorTrace } from "./ErrorTrace";
import {
  describeActionError,
  useConnectorActions,
  type ActionFeedback,
} from "../hooks/useConnectorActions";
import { snapshotQueryKey } from "../hooks/useClusterStream";

export interface ConnectorDetailDrawerProps {
  clusterId: string;
  connectorName: string | null;
  open: boolean;
  onClose: () => void;
}

export function ConnectorDetailDrawer({
  clusterId,
  connectorName,
  open,
  onClose,
}: ConnectorDetailDrawerProps): ReactElement {
  const api = useApi();
  const queryClient = useQueryClient();
  const { canOperate } = useCurrentUser();
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);

  const detailQuery = useQuery<ConnectorDetailDto>({
    queryKey: ["connector", clusterId, connectorName],
    queryFn: () => api.getConnectorDetail(clusterId, connectorName as string),
    enabled: open && !!connectorName,
    refetchInterval: open ? 8000 : false,
  });

  const actions = useConnectorActions(clusterId, connectorName ?? "");

  const runAction = (
    kind: Parameters<typeof actions.mutate>[0]["kind"],
    taskId?: number,
  ) => {
    actions.mutate(
      { kind, taskId },
      {
        onSuccess: () => {
          setFeedback({ severity: "success", message: "Action accepted." });
          // Refresh detail + snapshot after Connect settles.
          setTimeout(() => {
            void detailQuery.refetch();
            void queryClient.invalidateQueries({ queryKey: snapshotQueryKey(clusterId) });
          }, 1200);
        },
        onError: (err) => setFeedback(describeActionError(err)),
      },
    );
  };

  const detail = detailQuery.data;
  const isSink = detail?.type === "sink";
  const busy = actions.isPending;

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 560 }, maxWidth: "100%" } } }}
    >
      <Box sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack direction="row" alignItems="center" spacing={1} mb={1}>
          <Typography variant="h6" flexGrow={1} noWrap title={connectorName ?? undefined}>
            {connectorName ?? "Connector"}
          </Typography>
          {detail && <HealthPill health={detail.health} />}
          <IconButton onClick={onClose} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Stack>

        {detailQuery.isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {detailQuery.isError && (
          <Alert severity="error">
            Failed to load connector detail:{" "}
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : "unknown error"}
          </Alert>
        )}

        {detail && (
          <Box sx={{ overflow: "auto", pr: 0.5 }}>
            <Stack direction="row" spacing={1} mb={1} flexWrap="wrap" useFlexGap>
              <Typography variant="body2" color="text.secondary">
                {detail.type} · {shortClass(detail.connectorClass)}
              </Typography>
            </Stack>

            {/* RBAC-gated actions */}
            <ActionBar
              canOperate={canOperate}
              busy={busy}
              onPause={() => runAction("pause")}
              onResume={() => runAction("resume")}
              onRestart={() => runAction("restart")}
              onRestartFailed={() => runAction("restart-failed")}
            />

            <SectionLabel>Tasks ({detail.failedTasks} failed / {detail.totalTasks})</SectionLabel>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Worker</TableCell>
                    <TableCell align="right">Restart</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detail.tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell>{task.id}</TableCell>
                      <TableCell>
                        <HealthPill health={task.state} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 160 }}>
                        <Typography variant="body2" noWrap title={task.workerId ?? undefined}>
                          {task.workerId ?? "—"}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip
                          title={canOperate ? "Restart this task" : "Operator role required"}
                        >
                          <span>
                            <IconButton
                              size="small"
                              disabled={!canOperate || busy}
                              onClick={() => runAction("task-restart", task.id)}
                              aria-label={`Restart task ${task.id}`}
                            >
                              <ReplayIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Per-task error traces */}
            {detail.tasks.some((t) => t.trace) && (
              <>
                <SectionLabel>Errors</SectionLabel>
                <Stack spacing={1}>
                  {detail.tasks
                    .filter((t) => t.trace)
                    .map((t) => (
                      <Box key={t.id}>
                        <Typography variant="caption" color="text.secondary">
                          Task {t.id}
                        </Typography>
                        <ErrorTrace trace={t.trace as string} />
                      </Box>
                    ))}
                </Stack>
              </>
            )}

            {/* Lag (sink) */}
            {isSink && detail.lag && (
              <>
                <SectionLabel>Lag (total {detail.lag.totalLag.toLocaleString()})</SectionLabel>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Topic</TableCell>
                        <TableCell align="right">Partition</TableCell>
                        <TableCell align="right">Current</TableCell>
                        <TableCell align="right">End</TableCell>
                        <TableCell align="right">Lag</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {detail.lag.byPartition.map((p) => (
                        <TableRow key={`${p.topic}-${p.partition}`}>
                          <TableCell>
                            <Typography variant="body2" noWrap title={p.topic}>
                              {p.topic}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{p.partition}</TableCell>
                          <TableCell align="right">{p.currentOffset.toLocaleString()}</TableCell>
                          <TableCell align="right">{p.endOffset.toLocaleString()}</TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: p.lag > 0 ? "warning.main" : "text.primary" }}
                          >
                            {p.lag.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {/* Config (already masked by backend) */}
            <SectionLabel>Config</SectionLabel>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {Object.entries(detail.config).map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell sx={{ verticalAlign: "top", width: "40%" }}>
                        <Typography variant="body2" fontFamily="monospace">
                          {key}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          fontFamily="monospace"
                          sx={{ wordBreak: "break-all" }}
                        >
                          {value}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!feedback}
        autoHideDuration={5000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {feedback ? (
          <Alert severity={feedback.severity} onClose={() => setFeedback(null)}>
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Drawer>
  );
}

function ActionBar({
  canOperate,
  busy,
  onPause,
  onResume,
  onRestart,
  onRestartFailed,
}: {
  canOperate: boolean;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onRestartFailed: () => void;
}): ReactElement {
  const gate = canOperate ? "" : "Operator role required";
  return (
    <Box>
      <Divider sx={{ mb: 1 }} />
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <GatedButton
          label="Pause"
          icon={<PauseIcon />}
          disabled={!canOperate || busy}
          tooltip={gate}
          onClick={onPause}
        />
        <GatedButton
          label="Resume"
          icon={<PlayArrowIcon />}
          disabled={!canOperate || busy}
          tooltip={gate}
          onClick={onResume}
        />
        <GatedButton
          label="Restart"
          icon={<RestartAltIcon />}
          disabled={!canOperate || busy}
          tooltip={gate}
          onClick={onRestart}
        />
        <GatedButton
          label="Restart failed tasks"
          icon={<ReplayIcon />}
          disabled={!canOperate || busy}
          tooltip={gate}
          onClick={onRestartFailed}
        />
      </Stack>
      <Divider sx={{ mt: 1 }} />
    </Box>
  );
}

function GatedButton({
  label,
  icon,
  disabled,
  tooltip,
  onClick,
}: {
  label: string;
  icon: ReactElement;
  disabled: boolean;
  tooltip: string;
  onClick: () => void;
}): ReactElement {
  return (
    <Tooltip title={tooltip}>
      <span>
        <Button
          size="small"
          variant="outlined"
          startIcon={icon}
          disabled={disabled}
          onClick={onClick}
        >
          {label}
        </Button>
      </span>
    </Tooltip>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }): ReactElement {
  return (
    <Typography variant="overline" color="text.secondary" display="block" mt={2} mb={0.5}>
      {children}
    </Typography>
  );
}

export function shortClass(connectorClass: string | null): string {
  if (!connectorClass) return "—";
  const parts = connectorClass.split(".");
  return parts[parts.length - 1] || connectorClass;
}
