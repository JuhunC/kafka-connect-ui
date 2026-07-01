package com.connectlens.model;

import java.util.List;

/**
 * Connector as shown in the grid/topology. {@code type} is "source" | "sink" | "unknown".
 * {@code state} is the connector-level state; {@code health} is the rollup (worst task state).
 */
public record ConnectorDto(
        String name,
        String connectorClass,
        String type,
        Health state,
        Health health,
        String workerId,
        int totalTasks,
        int failedTasks,
        List<TaskDto> tasks,
        List<String> topics,
        String externalSystemId,
        LagDto lag
) {}
