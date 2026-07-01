package com.connectlens.model;

/** An edge (a connector) between the Kafka hub and an external node. {@code direction}: "in" = source→kafka, "out" = kafka→sink. */
public record TopologyEdgeDto(
        String id,
        String source,
        String target,
        String connectorName,
        Health health,
        String direction
) {}
