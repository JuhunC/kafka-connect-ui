package com.connectlens.poller;

import com.connectlens.config.ConnectLensProperties.ClusterDef;
import com.connectlens.connect.ConnectRestClient;
import com.connectlens.connect.RawConnector;
import com.connectlens.connect.RootInfo;
import com.connectlens.error.ConnectUnavailableException;
import com.connectlens.kafka.ConsumerGroupInfo;
import com.connectlens.kafka.TopicInfo;
import com.connectlens.kafka.KafkaAdminService;
import com.connectlens.kafka.KafkaClusterInfo;
import com.connectlens.model.*;
import com.connectlens.sse.SseBroadcaster;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;

/**
 * One isolated poll loop for a single cluster. Self-reschedules a fixed delay after each cycle
 * completes (never fixed wall-clock), so a slow Connect never causes overlapping polls. Cluster
 * metadata + lag refresh on the slow tier; connector/task status every fast tier. On a Connect
 * failure the last-good snapshot is served flagged stale — connectors are never flipped to FAILED
 * by a transient error.
 */
public class ClusterPoller {

    private static final Logger log = LoggerFactory.getLogger(ClusterPoller.class);

    private final ClusterDef cluster;
    private final ConnectRestClient connect;
    private final KafkaAdminService admin;
    private final Normalizer normalizer;
    private final StateStore store;
    private final SseBroadcaster broadcaster;
    private final long fastMs;
    private final long slowMs;
    private final boolean consumerGroupsEnabled;
    private final int consumerGroupsMax;
    private final boolean topicsEnabled;
    private final int topicsMax;
    private final long topicsWindow;

    private final ScheduledExecutorService exec;
    private volatile boolean running = false;
    private long cycle = 0;
    private long lastSlowTs = 0L;

    // slow-tier caches, reused on fast cycles
    private KafkaClusterInfo kafkaInfo = KafkaClusterInfo.unreachable();
    private RootInfo rootInfo = new RootInfo(null, null);
    private Map<String, LagDto> lagCache = new HashMap<>();
    private List<ConsumerGroupInfo> consumerGroupCache = List.of();
    private List<TopicInfo> topicCache = List.of();

    public ClusterPoller(ClusterDef cluster, ConnectRestClient connect, KafkaAdminService admin,
                         Normalizer normalizer, StateStore store, SseBroadcaster broadcaster,
                         long fastMs, long slowMs, boolean consumerGroupsEnabled, int consumerGroupsMax,
                         boolean topicsEnabled, int topicsMax, long topicsWindow) {
        this.cluster = cluster;
        this.connect = connect;
        this.admin = admin;
        this.normalizer = normalizer;
        this.store = store;
        this.broadcaster = broadcaster;
        this.fastMs = fastMs;
        this.slowMs = Math.max(0, slowMs);
        this.consumerGroupsEnabled = consumerGroupsEnabled;
        this.consumerGroupsMax = consumerGroupsMax;
        this.topicsEnabled = topicsEnabled;
        this.topicsMax = topicsMax;
        this.topicsWindow = topicsWindow;
        this.exec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "poller-" + cluster.getId());
            t.setDaemon(true);
            return t;
        });
    }

    public void start() {
        running = true;
        // small startup jitter so multiple clusters don't hit their Connect at the same instant
        long jitter = ThreadLocalRandom.current().nextLong(0, Math.max(1, fastMs));
        exec.schedule(this::runCycle, jitter, TimeUnit.MILLISECONDS);
    }

    public void stop() {
        running = false;
        exec.shutdownNow();
    }

    private void runCycle() {
        try {
            pollOnce();
        } catch (Exception e) {
            log.warn("Unexpected poll error for cluster {}: {}", cluster.getId(), e.toString());
        } finally {
            cycle++;
            if (running) {
                exec.schedule(this::runCycle, fastMs, TimeUnit.MILLISECONDS);
            }
        }
    }

    private void pollOnce() {
        Map<String, RawConnector> raw;
        try {
            raw = connect.listConnectors(cluster.getConnect());
        } catch (ConnectUnavailableException e) {
            log.debug("Connect unreachable for {}: {}", cluster.getId(), e.getMessage());
            serveStale();
            return;
        }

        long now = System.currentTimeMillis();
        // Time-based slow tier: run when at least slowMs has elapsed since the last slow run,
        // so the configured interval is honored regardless of the fast cadence.
        boolean slow = (lastSlowTs == 0L) || (now - lastSlowTs >= slowMs);
        if (slow) {
            lastSlowTs = now;
            kafkaInfo = admin.describe(cluster.getId(), cluster.getBootstrap());
            try {
                rootInfo = connect.getRoot(cluster.getConnect());
            } catch (Exception e) {
                rootInfo = new RootInfo(null, null);
            }
            Map<String, LagDto> newLag = new HashMap<>();
            Set<String> connectGroups = new HashSet<>();
            for (RawConnector rc : raw.values()) {
                if ("sink".equals(rc.type())) {
                    connectGroups.add("connect-" + rc.name());
                    LagDto l = admin.sinkLag(cluster.getId(), cluster.getBootstrap(), rc.name());
                    if (l != null) newLag.put(rc.name(), l);
                }
            }
            lagCache = newLag;

            // Consumer groups, excluding the Connect-owned groups above (those are shown as connectors).
            consumerGroupCache = consumerGroupsEnabled
                    ? admin.listConsumerGroups(cluster.getId(), cluster.getBootstrap(), connectGroups, consumerGroupsMax)
                    : List.of();

            topicCache = topicsEnabled
                    ? admin.listTopicInfos(cluster.getId(), cluster.getBootstrap(), topicsMax)
                    : List.of();
        }

        NormalizedResult nr = normalizer.normalize(cluster.getId(), raw, lagCache, consumerGroupCache,
                topicCache, kafkaInfo.reachable(), now, topicsWindow);
        ClusterHealthDto health = new ClusterHealthDto(
                cluster.getId(), kafkaInfo.kafkaClusterId(), kafkaInfo.brokersUp(), kafkaInfo.brokersTotal(),
                kafkaInfo.controllerId(), kafkaInfo.topicCount(), kafkaInfo.partitionCount(),
                kafkaInfo.underReplicatedPartitions(), kafkaInfo.offlinePartitions(),
                kafkaInfo.activeControllerCount(), rootInfo.version(), true, kafkaInfo.reachable());

        ClusterSnapshotDto snapshot = new ClusterSnapshotDto(
                cluster.getId(), cluster.getName(), now, false,
                health, nr.connectors(), nr.externalSystems(), nr.consumerGroups(), nr.topics(), nr.topology());

        store.put(cluster.getId(), snapshot, nr.details());
        broadcaster.broadcast(cluster.getId(), snapshot);
    }

    private void serveStale() {
        Optional<ClusterSnapshotDto> last = store.getSnapshot(cluster.getId());
        ClusterSnapshotDto stale;
        if (last.isPresent()) {
            stale = last.get().asStale();
        } else {
            TopologyDto topo = new TopologyDto(
                    List.of(new TopologyNodeDto("kafka:" + cluster.getId(), "kafka", "Kafka",
                            cluster.getId(), "hub", kafkaInfo.reachable() ? Health.RUNNING : Health.FAILED, null)),
                    List.of());
            ClusterHealthDto health = new ClusterHealthDto(
                    cluster.getId(), kafkaInfo.kafkaClusterId(), kafkaInfo.brokersUp(), kafkaInfo.brokersTotal(),
                    kafkaInfo.controllerId(), kafkaInfo.topicCount(), kafkaInfo.partitionCount(),
                    kafkaInfo.underReplicatedPartitions(), kafkaInfo.offlinePartitions(),
                    kafkaInfo.activeControllerCount(), rootInfo.version(), false, kafkaInfo.reachable());
            stale = new ClusterSnapshotDto(cluster.getId(), cluster.getName(),
                    System.currentTimeMillis(), true, health, List.of(), List.of(), List.of(), List.of(), topo);
        }
        store.putSnapshot(cluster.getId(), stale);
        broadcaster.broadcast(cluster.getId(), stale);
    }
}
