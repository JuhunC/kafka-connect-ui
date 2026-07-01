package com.connectlens.model;

public record ClusterHealthDto(
        String clusterId,
        String kafkaClusterId,
        int brokersUp,
        int brokersTotal,
        Integer controllerId,
        int topicCount,
        int partitionCount,
        int underReplicatedPartitions,
        int offlinePartitions,
        int activeControllerCount,
        String connectVersion,
        boolean connectReachable,
        boolean kafkaReachable
) {
    /** Placeholder used before the first successful poll / when Kafka is unreachable. */
    public static ClusterHealthDto unknown(String clusterId) {
        return new ClusterHealthDto(clusterId, null, 0, 0, null, 0, 0, 0, 0, 0, null, false, false);
    }
}
