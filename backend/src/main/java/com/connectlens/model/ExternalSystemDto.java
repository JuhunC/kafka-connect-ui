package com.connectlens.model;

import java.util.List;

/**
 * An external system linked to Kafka via one or more connectors (Postgres, Splunk, S3, ...).
 * {@code role} is "source" | "sink" | "unknown". {@code health} is the rollup across
 * contributing connectors; {@code reachability} is the (proxy or probed) system reachability.
 */
public record ExternalSystemDto(
        String id,
        String kind,
        String displayName,
        String endpoint,
        String role,
        Reachability reachability,
        Long lastSuccessTs,
        List<String> contributingConnectors,
        Health health
) {}
