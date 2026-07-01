package com.connectlens.model;

public record ClusterSummaryDto(
        String id,
        String name,
        String connectUrl,
        boolean connectReachable,
        boolean kafkaReachable,
        boolean stale,
        int brokerCount,
        int connectorCount,
        int failedConnectors,
        int degradedConnectors,
        Long lastPollTs
) {}
