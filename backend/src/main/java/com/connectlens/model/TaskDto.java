package com.connectlens.model;

public record TaskDto(
        int id,
        Health state,
        String workerId,
        String trace
) {}
