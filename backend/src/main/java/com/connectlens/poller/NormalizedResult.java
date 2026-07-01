package com.connectlens.poller;

import com.connectlens.model.ConnectorDetailDto;
import com.connectlens.model.ConnectorDto;
import com.connectlens.model.ExternalSystemDto;
import com.connectlens.model.TopologyDto;

import java.util.List;
import java.util.Map;

/** Output of normalizing one poll: grid connectors, per-connector detail (with masked config),
 *  external systems, and the topology graph. */
public record NormalizedResult(
        List<ConnectorDto> connectors,
        Map<String, ConnectorDetailDto> details,
        List<ExternalSystemDto> externalSystems,
        TopologyDto topology
) {}
