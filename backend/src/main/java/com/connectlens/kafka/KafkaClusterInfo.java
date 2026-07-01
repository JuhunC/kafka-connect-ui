package com.connectlens.kafka;

/** Kafka-side cluster facts gathered via AdminClient. Merged with Connect facts into ClusterHealthDto. */
public record KafkaClusterInfo(
        String kafkaClusterId,
        int brokersUp,
        int brokersTotal,
        Integer controllerId,
        int activeControllerCount,
        int topicCount,
        int partitionCount,
        int underReplicatedPartitions,
        int offlinePartitions,
        boolean reachable
) {
    public static KafkaClusterInfo unreachable() {
        return new KafkaClusterInfo(null, 0, 0, null, 0, 0, 0, 0, 0, false);
    }
}
