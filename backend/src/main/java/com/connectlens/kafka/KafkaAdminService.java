package com.connectlens.kafka;

import com.connectlens.model.LagDto;
import com.connectlens.model.LagPartitionDto;
import jakarta.annotation.PreDestroy;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.ListOffsetsResult;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.admin.TopicDescription;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.Node;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.TopicPartitionInfo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * One long-lived AdminClient per cluster. Provides cluster metadata (brokers, controller, URP,
 * offline partitions) and authoritative sink-connector lag via the {@code connect-<name>} group.
 */
@Service
public class KafkaAdminService {

    private static final Logger log = LoggerFactory.getLogger(KafkaAdminService.class);
    private static final Duration API_TIMEOUT = Duration.ofSeconds(8);

    private final Map<String, Admin> admins = new ConcurrentHashMap<>();

    private Admin adminFor(String clusterId, String bootstrap) {
        return admins.computeIfAbsent(clusterId, id -> {
            Properties p = new Properties();
            p.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap);
            p.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, 8000);
            p.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, 10000);
            p.put(AdminClientConfig.CLIENT_ID_CONFIG, "connectlens-" + clusterId);
            return Admin.create(p);
        });
    }

    /** Gather broker/topic/partition health. Never throws — returns {@code unreachable()} on failure. */
    public KafkaClusterInfo describe(String clusterId, String bootstrap) {
        try {
            Admin admin = adminFor(clusterId, bootstrap);
            var dc = admin.describeCluster();
            String kafkaClusterId = dc.clusterId().get(API_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            Collection<Node> nodes = dc.nodes().get(API_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            Node controller = dc.controller().get(API_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);

            Set<String> topicNames = admin.listTopics().names()
                    .get(API_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            Map<String, TopicDescription> descs = admin.describeTopics(topicNames).allTopicNames()
                    .get(API_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);

            int partitionCount = 0, urp = 0, offline = 0;
            for (TopicDescription d : descs.values()) {
                for (TopicPartitionInfo tp : d.partitions()) {
                    partitionCount++;
                    if (tp.leader() == null || tp.leader().id() < 0) offline++;
                    if (tp.isr().size() < tp.replicas().size()) urp++;
                }
            }
            Integer controllerId = controller == null ? null : controller.id();
            int activeControllers = controller == null ? 0 : 1;
            return new KafkaClusterInfo(kafkaClusterId, nodes.size(), nodes.size(), controllerId,
                    activeControllers, topicNames.size(), partitionCount, urp, offline, true);
        } catch (Exception e) {
            log.warn("Kafka describe failed for cluster {} ({}): {}", clusterId, bootstrap, e.toString());
            return KafkaClusterInfo.unreachable();
        }
    }

    /**
     * Authoritative lag for a sink connector: lag = endOffset − committedOffset summed over the
     * partitions the {@code connect-<name>} consumer group has committed. Returns null if the group
     * has no committed offsets yet (e.g. a freshly created or failed sink) or on error.
     */
    public LagDto sinkLag(String clusterId, String bootstrap, String connectorName) {
        String group = "connect-" + connectorName;
        try {
            Admin admin = adminFor(clusterId, bootstrap);
            Map<TopicPartition, OffsetAndMetadata> committed = admin.listConsumerGroupOffsets(group)
                    .partitionsToOffsetAndMetadata()
                    .get(API_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            if (committed == null || committed.isEmpty()) {
                return null;
            }
            Map<TopicPartition, OffsetSpec> latestSpec = new HashMap<>();
            for (TopicPartition tp : committed.keySet()) {
                latestSpec.put(tp, OffsetSpec.latest());
            }
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> end = admin.listOffsets(latestSpec)
                    .all().get(API_TIMEOUT.toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);

            List<LagPartitionDto> parts = new ArrayList<>();
            long total = 0;
            for (Map.Entry<TopicPartition, OffsetAndMetadata> e : committed.entrySet()) {
                TopicPartition tp = e.getKey();
                long current = e.getValue().offset();
                long endOffset = end.containsKey(tp) ? end.get(tp).offset() : current;
                long lag = Math.max(0, endOffset - current);
                total += lag;
                parts.add(new LagPartitionDto(tp.topic(), tp.partition(), current, endOffset, lag));
            }
            parts.sort((a, b) -> Long.compare(b.lag(), a.lag()));
            return new LagDto(total, parts);
        } catch (Exception e) {
            log.debug("Lag lookup failed for {} on {}: {}", connectorName, clusterId, e.toString());
            return null;
        }
    }

    @PreDestroy
    public void close() {
        admins.values().forEach(a -> {
            try { a.close(Duration.ofSeconds(2)); } catch (Exception ignored) { }
        });
    }
}
