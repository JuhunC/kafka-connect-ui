package com.connectlens.poller;

import com.connectlens.model.ClusterSnapshotDto;
import com.connectlens.model.ConnectorDetailDto;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Authoritative in-memory current state, per cluster. Single-instance (see plan §8.2 for HA). */
@Component
public class StateStore {

    private record Cached(ClusterSnapshotDto snapshot, Map<String, ConnectorDetailDto> details) {}

    private final Map<String, Cached> byCluster = new ConcurrentHashMap<>();

    public void put(String clusterId, ClusterSnapshotDto snapshot, Map<String, ConnectorDetailDto> details) {
        byCluster.put(clusterId, new Cached(snapshot, details));
    }

    /** Replace only the snapshot (e.g. to flag it stale) while keeping cached detail. */
    public void putSnapshot(String clusterId, ClusterSnapshotDto snapshot) {
        Cached prev = byCluster.get(clusterId);
        byCluster.put(clusterId, new Cached(snapshot, prev == null ? Map.of() : prev.details()));
    }

    public Optional<ClusterSnapshotDto> getSnapshot(String clusterId) {
        Cached c = byCluster.get(clusterId);
        return c == null ? Optional.empty() : Optional.of(c.snapshot());
    }

    public Optional<ConnectorDetailDto> getDetail(String clusterId, String connectorName) {
        Cached c = byCluster.get(clusterId);
        if (c == null) return Optional.empty();
        return Optional.ofNullable(c.details().get(connectorName));
    }
}
