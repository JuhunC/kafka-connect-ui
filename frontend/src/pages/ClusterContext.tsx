// Shares the selected cluster id + live snapshot (via SSE stream) across the
// layout and pages. Loads the cluster list and defaults to the first cluster.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useApi } from "../api/ApiProvider";
import type { ClusterSnapshotDto, ClusterSummaryDto } from "../api/types";
import { useClusterStream, type StreamStatus } from "../hooks/useClusterStream";

interface ClusterContextValue {
  clusters: ClusterSummaryDto[];
  clustersLoading: boolean;
  clustersError: unknown;
  selectedClusterId: string | null;
  selectCluster: (id: string) => void;
  snapshot: ClusterSnapshotDto | null;
  streamStatus: StreamStatus;
  streamError: string | null;
}

const Ctx = createContext<ClusterContextValue | null>(null);

export function ClusterProvider({ children }: { children: ReactNode }): ReactNode {
  const api = useApi();
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);

  const clustersQuery = useQuery<ClusterSummaryDto[]>({
    queryKey: ["clusters"],
    queryFn: () => api.getClusters(),
    refetchInterval: 30000,
  });

  // Default to the first cluster once the list arrives.
  useEffect(() => {
    if (!selectedClusterId && clustersQuery.data && clustersQuery.data.length > 0) {
      setSelectedClusterId(clustersQuery.data[0].id);
    }
  }, [clustersQuery.data, selectedClusterId]);

  const { snapshot, status, error } = useClusterStream(selectedClusterId);

  const value = useMemo<ClusterContextValue>(
    () => ({
      clusters: clustersQuery.data ?? [],
      clustersLoading: clustersQuery.isLoading,
      clustersError: clustersQuery.error,
      selectedClusterId,
      selectCluster: setSelectedClusterId,
      snapshot,
      streamStatus: status,
      streamError: error,
    }),
    [
      clustersQuery.data,
      clustersQuery.isLoading,
      clustersQuery.error,
      selectedClusterId,
      snapshot,
      status,
      error,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClusterContext(): ClusterContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useClusterContext must be used within <ClusterProvider>");
  return ctx;
}
