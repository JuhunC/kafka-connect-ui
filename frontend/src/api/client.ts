// Fetch wrapper for the ConnectLens backend.
//
// All calls are same-origin `/api/...`. The bearer token is supplied by the
// caller (pulled from the oidc user) so this module has no dependency on the
// auth library and stays easily testable.

import { config } from "../config";
import type {
  ClusterSnapshotDto,
  ClusterSummaryDto,
  ConnectorDetailDto,
  ConsumerGroupDto,
  MeDto,
  TopicDto,
  VersionDto,
} from "./types";

/** Typed API error. `status` mirrors the HTTP status; `code` classifies known cases. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly body: unknown;

  constructor(status: number, code: ApiErrorCode, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export type ApiErrorCode =
  | "UNAUTHORIZED" // 401
  | "FORBIDDEN" // 403
  | "NOT_FOUND" // 404 (unknown cluster/connector)
  | "REBALANCING" // 409 passthrough {error:"rebalancing"}
  | "BAD_GATEWAY" // 502 Connect unreachable during action
  | "CONFLICT" // other 409
  | "HTTP_ERROR" // any other non-2xx
  | "NETWORK"; // fetch rejected / offline

/** Provider of the current access token. Returns null when unauthenticated. */
export type TokenProvider = () => string | null | undefined;

export interface ApiClientOptions {
  getToken: TokenProvider;
}

function apiUrl(path: string): string {
  // path already starts with "/api/..."
  return `${config.apiBase}${path}`;
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function classify(status: number, body: unknown): { code: ApiErrorCode; message: string } {
  const errMsg =
    body && typeof body === "object" && "error" in body
      ? String((body as { error: unknown }).error)
      : undefined;

  switch (status) {
    case 401:
      return { code: "UNAUTHORIZED", message: errMsg ?? "Not authenticated" };
    case 403:
      return { code: "FORBIDDEN", message: errMsg ?? "Insufficient permissions" };
    case 404:
      return { code: "NOT_FOUND", message: errMsg ?? "Not found" };
    case 409:
      if (errMsg === "rebalancing") {
        return { code: "REBALANCING", message: "Cluster is rebalancing, try again shortly" };
      }
      return { code: "CONFLICT", message: errMsg ?? "Conflict" };
    case 502:
      return { code: "BAD_GATEWAY", message: errMsg ?? "Connect is unreachable" };
    default:
      return { code: "HTTP_ERROR", message: errMsg ?? `Request failed (${status})` };
  }
}

export class ApiClient {
  private readonly getToken: TokenProvider;

  constructor(opts: ApiClientOptions) {
    this.getToken = opts.getToken;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let res: Response;
    try {
      res = await fetch(apiUrl(path), { ...init, headers });
    } catch (cause) {
      throw new ApiError(0, "NETWORK", "Network request failed", cause);
    }

    if (!res.ok) {
      const body = await parseBody(res);
      const { code, message } = classify(res.status, body);
      throw new ApiError(res.status, code, message, body);
    }

    // 202/204 have no meaningful body.
    if (res.status === 204 || res.status === 202) {
      return undefined as T;
    }
    return (await parseBody(res)) as T;
  }

  // ---- Reads ------------------------------------------------------------

  getVersion(): Promise<VersionDto> {
    return this.request<VersionDto>("/api/version");
  }

  getMe(): Promise<MeDto> {
    return this.request<MeDto>("/api/me");
  }

  getClusters(): Promise<ClusterSummaryDto[]> {
    return this.request<ClusterSummaryDto[]>("/api/clusters");
  }

  getSnapshot(clusterId: string): Promise<ClusterSnapshotDto> {
    return this.request<ClusterSnapshotDto>(
      `/api/clusters/${encodeURIComponent(clusterId)}/snapshot`,
    );
  }

  getConnectorDetail(clusterId: string, name: string): Promise<ConnectorDetailDto> {
    return this.request<ConnectorDetailDto>(
      `/api/clusters/${encodeURIComponent(clusterId)}/connectors/${encodeURIComponent(name)}`,
    );
  }

  getConsumerGroups(clusterId: string): Promise<ConsumerGroupDto[]> {
    return this.request<ConsumerGroupDto[]>(
      `/api/clusters/${encodeURIComponent(clusterId)}/consumer-groups`,
    );
  }

  getTopics(clusterId: string): Promise<TopicDto[]> {
    return this.request<TopicDto[]>(
      `/api/clusters/${encodeURIComponent(clusterId)}/topics`,
    );
  }

  // ---- Actions (POST, 202 Accepted) -------------------------------------

  private action(clusterId: string, name: string, verb: string): Promise<void> {
    return this.request<void>(
      `/api/clusters/${encodeURIComponent(clusterId)}/connectors/${encodeURIComponent(name)}/${verb}`,
      { method: "POST" },
    );
  }

  pauseConnector(clusterId: string, name: string): Promise<void> {
    return this.action(clusterId, name, "pause");
  }

  resumeConnector(clusterId: string, name: string): Promise<void> {
    return this.action(clusterId, name, "resume");
  }

  restartConnector(clusterId: string, name: string): Promise<void> {
    return this.action(clusterId, name, "restart");
  }

  restartFailedTasks(clusterId: string, name: string): Promise<void> {
    return this.action(clusterId, name, "restart-failed");
  }

  restartTask(clusterId: string, name: string, taskId: number): Promise<void> {
    return this.request<void>(
      `/api/clusters/${encodeURIComponent(clusterId)}/connectors/${encodeURIComponent(
        name,
      )}/tasks/${taskId}/restart`,
      { method: "POST" },
    );
  }
}
