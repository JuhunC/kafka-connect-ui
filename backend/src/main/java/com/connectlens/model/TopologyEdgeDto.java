package com.connectlens.model;

/**
 * A topology edge. {@code kind} differentiates a connector (Kafka ↔ external system) from a
 * consumer group (Kafka → group). {@code direction}: "in" = source→kafka, "out" = kafka→sink/group.
 */
public record TopologyEdgeDto(
        String id,
        String source,
        String target,
        String kind,              // "connector" | "consumer"
        String connectorName,     // set when kind = connector, else null
        String groupId,           // set when kind = consumer, else null
        String label,             // display label (connector name or group id)
        Health health,
        String direction
) {}
