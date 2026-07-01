package com.connectlens.model;

/** A node in the topology graph. {@code kind} is "kafka" | "external"; {@code role} is "source" | "sink" | "hub". */
public record TopologyNodeDto(
        String id,
        String kind,
        String label,
        String sublabel,
        String role,
        Health health,
        String systemKind
) {}
