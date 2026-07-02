package com.connectlens.model;

import java.util.List;

/**
 * A Kafka consumer group (an application consuming from Kafka), distinct from a connector.
 * Connect-owned groups ({@code connect-<sink-connector>}) are excluded — they are shown as connectors.
 */
public record ConsumerGroupDto(
        String groupId,
        String state,            // raw Kafka state: "Stable" | "Empty" | "Dead" | "PreparingRebalance" | ...
        Health health,           // derived from state for the UI pill
        int memberCount,
        Integer coordinatorId,
        List<String> topics,     // distinct topics the group has committed offsets on
        Long totalLag            // sum of (logEndOffset − committedOffset); null if unknown
) {}
