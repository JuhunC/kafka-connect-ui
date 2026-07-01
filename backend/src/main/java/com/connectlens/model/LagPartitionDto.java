package com.connectlens.model;

public record LagPartitionDto(
        String topic,
        int partition,
        long currentOffset,
        long endOffset,
        long lag
) {}
