package com.connectlens.inference;

/** The external system a connector binds to, inferred from its class + config. */
public record InferredSystem(
        String id,
        String kind,
        String displayName,
        String endpoint,
        String role   // "source" | "sink" | "unknown"
) {}
