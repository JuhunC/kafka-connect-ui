package com.connectlens.connect;

import java.util.List;
import java.util.Map;

/** Merged view of a connector's info (config) + status, straight from the Connect REST API. */
public record RawConnector(
        String name,
        String type,              // "source" | "sink" | "unknown"
        String connectorClass,
        Map<String, String> config,
        String connectorState,    // raw state string from Connect, e.g. "RUNNING"
        String workerId,
        List<RawTask> tasks
) {}
