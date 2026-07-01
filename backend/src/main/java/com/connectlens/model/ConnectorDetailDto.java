package com.connectlens.model;

import com.fasterxml.jackson.annotation.JsonUnwrapped;

import java.util.Map;

/**
 * Connector detail = the grid connector fields (unwrapped, so the JSON is flat) plus the
 * masked configuration map. Secrets are already masked to "********" by the backend.
 */
public record ConnectorDetailDto(
        @JsonUnwrapped ConnectorDto connector,
        Map<String, String> config
) {}
