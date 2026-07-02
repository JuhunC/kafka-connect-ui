package com.connectlens.kafka;

import com.connectlens.model.LagDto;
import com.connectlens.model.LagPartitionDto;
import jakarta.annotation.PreDestroy;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.apache.kafka.clients.admin.ConsumerGroupDescription;
import org.apache.kafka.clients.admin.ConsumerGroupListing;
import org.apache.kafka.clients.admin.ListConsumerGroupOffsetsSpec;
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
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

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

    /**
     * List real consumer groups (state, members, topics, total lag), EXCLUDING the given
     * Connect-owned group ids (sink connectors' {@code connect-<name>} groups) so they are not
     * double-counted — they are represented as connectors. Capped at {@code max} groups to bound
     * broker load; committed offsets are fetched in one batched call (KIP-709). Never throws.
     */
    public List<ConsumerGroupInfo> listConsumerGroups(String clusterId, String bootstrap,
                                                      Set<String> excludeGroupIds, int max) {
        try {
            Admin admin = adminFor(clusterId, bootstrap);
            Collection<ConsumerGroupListing> listings = admin.listConsumerGroups().all()
                    .get(API_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            List<String> ids = new ArrayList<>(listings.stream()
                    .map(ConsumerGroupListing::groupId)
                    .filter(id -> id != null && !excludeGroupIds.contains(id))
                    .sorted()
                    .toList());
            if (ids.isEmpty()) {
                return List.of();
            }
            if (ids.size() > max) {
                log.info("Cluster {} has {} consumer groups; describing the first {} (connectlens.consumer-groups.max)",
                        clusterId, ids.size(), max);
                ids = ids.subList(0, max);
            }

            Map<String, ConsumerGroupDescription> descs = admin.describeConsumerGroups(ids).all()
                    .get(API_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);

            // One batched call for all groups' committed offsets, then one listOffsets for the union.
            Map<String, ListConsumerGroupOffsetsSpec> spec = new HashMap<>();
            for (String id : ids) {
                spec.put(id, new ListConsumerGroupOffsetsSpec());
            }
            Map<String, Map<TopicPartition, OffsetAndMetadata>> committedByGroup =
                    admin.listConsumerGroupOffsets(spec).all().get(API_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);

            Map<TopicPartition, OffsetSpec> latestSpec = new HashMap<>();
            for (Map<TopicPartition, OffsetAndMetadata> m : committedByGroup.values()) {
                for (TopicPartition tp : m.keySet()) {
                    latestSpec.put(tp, OffsetSpec.latest());
                }
            }
            Map<TopicPartition, ListOffsetsResult.ListOffsetsResultInfo> ends = latestSpec.isEmpty()
                    ? Map.of()
                    : admin.listOffsets(latestSpec).all().get(API_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);

            List<ConsumerGroupInfo> out = new ArrayList<>();
            for (String id : ids) {
                ConsumerGroupDescription d = descs.get(id);
                String state = (d != null && d.state() != null) ? d.state().toString() : "Unknown";
                int members = d != null ? d.members().size() : 0;
                Integer coordinator = (d != null && d.coordinator() != null) ? d.coordinator().id() : null;

                Map<TopicPartition, OffsetAndMetadata> committed = committedByGroup.getOrDefault(id, Map.of());
                Set<String> topics = new TreeSet<>();
                long lag = 0;
                boolean hasLag = !committed.isEmpty();
                for (Map.Entry<TopicPartition, OffsetAndMetadata> e : committed.entrySet()) {
                    TopicPartition tp = e.getKey();
                    topics.add(tp.topic());
                    long c = e.getValue().offset();
                    long end = ends.containsKey(tp) ? ends.get(tp).offset() : c;
                    lag += Math.max(0, end - c);
                }
                out.add(new ConsumerGroupInfo(id, state, members, coordinator,
                        new ArrayList<>(topics), hasLag ? lag : null));
            }
            return out;
        } catch (Exception e) {
            log.warn("Consumer group listing failed for cluster {} ({}): {}", clusterId, bootstrap, e.toString());
            return List.of();
        }
    }

    @PreDestroy
    public void close() {
        admins.values().forEach(a -> {
            try { a.close(Duration.ofSeconds(2)); } catch (Exception ignored) { }
        });
    }
}
