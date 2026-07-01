package com.connectlens.model;

import java.util.List;

/** The complete, authoritative current state of one cluster — the SSE payload and snapshot response. */
public record ClusterSnapshotDto(
        String clusterId,
        String name,
        Long lastPollTs,
        boolean stale,
        ClusterHealthDto cluster,
        List<ConnectorDto> connectors,
        List<ExternalSystemDto> externalSystems,
        TopologyDto topology
) {
    /** A copy of this snapshot flagged stale (used when a poll fails and we serve last-good state). */
    public ClusterSnapshotDto asStale() {
        return new ClusterSnapshotDto(clusterId, name, lastPollTs, true, cluster, connectors, externalSystems, topology);
    }
}
