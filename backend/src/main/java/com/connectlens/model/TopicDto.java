package com.connectlens.model;

/**
 * A Kafka topic with producer-activity info. {@code lastMessageTs} = epoch millis of the most
 * recent record across partitions (null if empty). {@code state}: "ACTIVE" (produced within the
 * active window) | "IDLE" (has data, none recent) | "EMPTY" (no data).
 */
public record TopicDto(
        String name,
        int partitions,
        long endOffsetSum,
        Long lastMessageTs,
        String state,
        Health health
) {}
