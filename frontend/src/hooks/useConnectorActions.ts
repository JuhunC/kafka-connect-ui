// Connector action mutations (pause/resume/restart/restart-failed/task-restart)
// with typed error surfacing (409 rebalancing, 502 unreachable, 403 forbidden).

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { useApi } from "../api/ApiProvider";
import { ApiError } from "../api/client";

export type ConnectorActionKind =
  | "pause"
  | "resume"
  | "restart"
  | "restart-failed"
  | "task-restart";

export interface ConnectorActionVars {
  kind: ConnectorActionKind;
  taskId?: number;
}

export interface ActionFeedback {
  severity: "success" | "error" | "warning";
  message: string;
}

export function describeActionError(err: unknown): ActionFeedback {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "REBALANCING":
        return { severity: "warning", message: "Cluster is rebalancing — try again shortly." };
      case "BAD_GATEWAY":
        return { severity: "error", message: "Connect is unreachable right now." };
      case "FORBIDDEN":
        return { severity: "error", message: "You don't have permission for this action." };
      default:
        return { severity: "error", message: err.message };
    }
  }
  return { severity: "error", message: "Action failed." };
}

export function useConnectorActions(
  clusterId: string,
  connectorName: string,
): UseMutationResult<void, unknown, ConnectorActionVars> {
  const api = useApi();

  return useMutation<void, unknown, ConnectorActionVars>({
    mutationFn: async ({ kind, taskId }) => {
      switch (kind) {
        case "pause":
          return api.pauseConnector(clusterId, connectorName);
        case "resume":
          return api.resumeConnector(clusterId, connectorName);
        case "restart":
          return api.restartConnector(clusterId, connectorName);
        case "restart-failed":
          return api.restartFailedTasks(clusterId, connectorName);
        case "task-restart":
          if (taskId === undefined) throw new Error("taskId required for task-restart");
          return api.restartTask(clusterId, connectorName, taskId);
      }
    },
  });
}
