package com.connectlens.web;

import com.connectlens.config.ClusterRegistry;
import com.connectlens.config.ConnectLensProperties.ClusterDef;
import com.connectlens.connect.ConnectRestClient;
import com.connectlens.error.NotFoundException;
import com.connectlens.model.*;
import com.connectlens.poller.StateStore;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/clusters")
public class ClusterController {

    private final ClusterRegistry registry;
    private final StateStore store;
    private final ConnectRestClient connect;

    public ClusterController(ClusterRegistry registry, StateStore store, ConnectRestClient connect) {
        this.registry = registry;
        this.store = store;
        this.connect = connect;
    }

    @GetMapping
    public List<ClusterSummaryDto> clusters() {
        List<ClusterSummaryDto> out = new ArrayList<>();
        for (ClusterDef c : registry.all()) {
            ClusterSnapshotDto snap = store.getSnapshot(c.getId()).orElse(null);
            if (snap == null) {
                out.add(new ClusterSummaryDto(c.getId(), c.getName(), c.getConnect(),
                        false, false, false, 0, 0, 0, 0, null));
                continue;
            }
            int failed = 0, degraded = 0;
            for (ConnectorDto conn : snap.connectors()) {
                if (conn.health() == Health.FAILED) failed++;
                else if (conn.health() == Health.DEGRADED) degraded++;
            }
            out.add(new ClusterSummaryDto(
                    c.getId(), c.getName(), c.getConnect(),
                    snap.cluster().connectReachable(), snap.cluster().kafkaReachable(), snap.stale(),
                    snap.cluster().brokersUp(), snap.connectors().size(), failed, degraded, snap.lastPollTs()));
        }
        return out;
    }

    @GetMapping("/{clusterId}/snapshot")
    public ClusterSnapshotDto snapshot(@PathVariable String clusterId) {
        ClusterDef c = requireCluster(clusterId);
        return store.getSnapshot(clusterId).orElseGet(() -> placeholder(c));
    }

    @GetMapping("/{clusterId}/connectors/{name}")
    public ConnectorDetailDto connector(@PathVariable String clusterId, @PathVariable String name) {
        requireCluster(clusterId);
        return store.getDetail(clusterId, name)
                .orElseThrow(() -> new NotFoundException("Connector not found: " + name));
    }

    @GetMapping("/{clusterId}/consumer-groups")
    public List<ConsumerGroupDto> consumerGroups(@PathVariable String clusterId) {
        requireCluster(clusterId);
        return store.getSnapshot(clusterId).map(ClusterSnapshotDto::consumerGroups).orElseGet(List::of);
    }

    @GetMapping("/{clusterId}/topics")
    public List<TopicDto> topics(@PathVariable String clusterId) {
        requireCluster(clusterId);
        return store.getSnapshot(clusterId).map(ClusterSnapshotDto::topics).orElseGet(List::of);
    }

    @PostMapping("/{clusterId}/connectors/{name}/pause")
    @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
    public ResponseEntity<Void> pause(@PathVariable String clusterId, @PathVariable String name) {
        connect.pause(requireCluster(clusterId).getConnect(), name);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/{clusterId}/connectors/{name}/resume")
    @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
    public ResponseEntity<Void> resume(@PathVariable String clusterId, @PathVariable String name) {
        connect.resume(requireCluster(clusterId).getConnect(), name);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/{clusterId}/connectors/{name}/restart")
    @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
    public ResponseEntity<Void> restart(@PathVariable String clusterId, @PathVariable String name) {
        connect.restart(requireCluster(clusterId).getConnect(), name);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/{clusterId}/connectors/{name}/restart-failed")
    @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
    public ResponseEntity<Void> restartFailed(@PathVariable String clusterId, @PathVariable String name) {
        connect.restartFailed(requireCluster(clusterId).getConnect(), name);
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/{clusterId}/connectors/{name}/tasks/{taskId}/restart")
    @PreAuthorize("hasAnyRole('OPERATOR','ADMIN')")
    public ResponseEntity<Void> restartTask(@PathVariable String clusterId, @PathVariable String name,
                                            @PathVariable int taskId) {
        connect.restartTask(requireCluster(clusterId).getConnect(), name, taskId);
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    private ClusterDef requireCluster(String clusterId) {
        return registry.find(clusterId)
                .orElseThrow(() -> new NotFoundException("Unknown cluster: " + clusterId));
    }

    private ClusterSnapshotDto placeholder(ClusterDef c) {
        TopologyDto topo = new TopologyDto(
                List.of(new TopologyNodeDto("kafka:" + c.getId(), "kafka", "Kafka",
                        c.getId(), "hub", Health.UNKNOWN, null)),
                List.of());
        return new ClusterSnapshotDto(c.getId(), c.getName(), null, true,
                ClusterHealthDto.unknown(c.getId()), List.of(), List.of(), List.of(), List.of(), topo);
    }
}
