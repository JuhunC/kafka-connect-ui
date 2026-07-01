package com.connectlens.model;

import java.util.List;

public record LagDto(
        long totalLag,
        List<LagPartitionDto> byPartition
) {}
