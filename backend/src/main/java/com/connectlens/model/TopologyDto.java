package com.connectlens.model;

import java.util.List;

public record TopologyDto(
        List<TopologyNodeDto> nodes,
        List<TopologyEdgeDto> edges
) {}
