// Subscribes to GET /api/clusters/{clusterId}/events (SSE) using
// @microsoft/fetch-event-source so we can attach the bearer token header
// (native EventSource cannot send headers).
//
// Behaviour:
//  - On each `snapshot` event, parse ClusterSnapshotDto and write it into both
//    local state and the TanStack Query cache (key: ["snapshot", clusterId]).
//  - `error` events surface a message but keep the stream open (server decides).
//  - Network/stream failures trigger reconnect (handled by fetch-event-source)
//    and, after repeated failures, a polling fallback via getSnapshot at the
//    fast interval so the UI keeps updating.

import { useEffect, useRef, useState } from "react";
import {
  EventStreamContentType,
  fetchEventSource,
  type EventSourceMessage,
} from "@microsoft/fetch-event-source";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import { config } from "../config";
import type { ClusterSnapshotDto } from "../api/types";
import { useApi } from "../api/ApiProvider";

const FAST_INTERVAL_MS = 4000; // mirrors connectlens.poll.fast-interval-ms default

export type StreamStatus = "connecting" | "open" | "polling" | "error";

export interface ClusterStreamState {
  snapshot: ClusterSnapshotDto | null;
  status: StreamStatus;
  /** Last error message from an `error` SSE event or a stream failure. */
  error: string | null;
}

export function snapshotQueryKey(clusterId: string): [string, string] {
  return ["snapshot", clusterId];
}

/** Retriable HTTP status for the SSE stream (auth failures should not loop). */
class FatalStreamError extends Error {}

export function useClusterStream(clusterId: string | null): ClusterStreamState {
  // When auth is disabled there is no AuthProvider, so useAuth() must not be
  // consulted for a token. config.authEnabled is a module constant, so this
  // conditional hook call is stable for the app's lifetime.
  const accessToken = config.authEnabled
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useAuth().user?.access_token
    : undefined;
  const api = useApi();
  const queryClient = useQueryClient();

  const [snapshot, setSnapshot] = useState<ClusterSnapshotDto | null>(null);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [error, setError] = useState<string | null>(null);

  // Track the active cluster so a stale poll for a previous cluster is ignored.
  const activeClusterRef = useRef<string | null>(clusterId);
  activeClusterRef.current = clusterId;

  useEffect(() => {
    // With auth on we require a token before connecting; with auth off we
    // connect as soon as we have a cluster.
    if (!clusterId) return;
    if (config.authEnabled && !accessToken) return;

    // Reset when the target cluster changes.
    setSnapshot(null);
    setStatus("connecting");
    setError(null);

    const abort = new AbortController();
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const applySnapshot = (dto: ClusterSnapshotDto) => {
      if (activeClusterRef.current !== clusterId) return;
      setSnapshot(dto);
      queryClient.setQueryData(snapshotQueryKey(clusterId), dto);
    };

    const startPolling = () => {
      if (pollTimer || stopped) return;
      setStatus("polling");
      const tick = async () => {
        try {
          const dto = await api.getSnapshot(clusterId);
          if (!stopped) {
            applySnapshot(dto);
            setError(null);
          }
        } catch (e) {
          if (!stopped) setError(e instanceof Error ? e.message : "Polling failed");
        }
      };
      void tick();
      pollTimer = setInterval(() => void tick(), FAST_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const connect = async () => {
      try {
        await fetchEventSource(`${config.apiBase}/api/clusters/${encodeURIComponent(clusterId)}/events`, {
          signal: abort.signal,
          // No Authorization header when auth is disabled (there is no token).
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          openWhenHidden: true,
          async onopen(response) {
            const ct = response.headers.get("content-type") ?? "";
            if (response.ok && ct.includes(EventStreamContentType)) {
              stopPolling();
              setStatus("open");
              setError(null);
              return;
            }
            if (response.status === 401 || response.status === 403) {
              throw new FatalStreamError(`Not authorized for event stream (${response.status})`);
            }
            // Other non-OK: fall back to polling and let the retry logic run.
            throw new Error(`Event stream failed to open (${response.status})`);
          },
          onmessage(msg: EventSourceMessage) {
            if (!msg.data) return; // heartbeat comments arrive without an event
            if (msg.event === "error") {
              try {
                const parsed = JSON.parse(msg.data) as { message?: string };
                setError(parsed.message ?? "Cluster stream reported an error");
              } catch {
                setError("Cluster stream reported an error");
              }
              return;
            }
            // Default + explicit `snapshot` events carry a ClusterSnapshotDto.
            if (msg.event === "snapshot" || msg.event === "" || msg.event === undefined) {
              try {
                applySnapshot(JSON.parse(msg.data) as ClusterSnapshotDto);
              } catch {
                setError("Failed to parse snapshot from stream");
              }
            }
          },
          onerror(err) {
            // Fatal errors: stop retrying (throw to break out).
            if (err instanceof FatalStreamError) {
              setStatus("error");
              setError(err.message);
              throw err;
            }
            // Transient: surface, start polling as a safety net, and let
            // fetch-event-source retry the stream (return = keep retrying).
            setError(err instanceof Error ? err.message : "Stream connection lost");
            startPolling();
            return FAST_INTERVAL_MS; // retry delay
          },
          onclose() {
            // Server closed the stream; treat like a transient error → retry.
            throw new Error("Event stream closed by server");
          },
        });
      } catch {
        // Terminal failure (fatal error or aborted). Ensure polling if not aborted.
        if (!stopped) startPolling();
      }
    };

    void connect();

    return () => {
      stopped = true;
      abort.abort();
      stopPolling();
    };
  }, [clusterId, accessToken, api, queryClient]);

  return { snapshot, status, error };
}
