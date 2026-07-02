package com.connectlens.kafka;

/** Raw per-topic facts from AdminClient. {@code lastMessageTs} is the newest record timestamp
 *  across partitions (via OffsetSpec.maxTimestamp), or null if empty/unknown. */
public record TopicInfo(
        String name,
        int partitions,
        long endOffsetSum,
        Long lastMessageTs
) {}
