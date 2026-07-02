package com.connectlens.poller;

import com.connectlens.model.ConnectorDetailDto;
import com.connectlens.model.ConnectorDto;
import com.connectlens.model.ConsumerGroupDto;
import com.connectlens.model.ExternalSystemDto;
import com.connectlens.model.TopicDto;
import com.connectlens.model.TopologyDto;

import java.util.List;
import java.util.Map;

/** Output of normalizing one poll: connectors, per-connector detail, external systems, consumer
 *  groups, topics, and the topology graph. */
public record NormalizedResult(
        List<ConnectorDto> connectors,
        Map<String, ConnectorDetailDto> details,
        List<ExternalSystemDto> externalSystems,
        List<ConsumerGroupDto> consumerGroups,
        List<TopicDto> topics,
        TopologyDto topology
) {}
