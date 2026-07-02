package com.connectlens.kafka;

import java.util.List;

/** Raw consumer-group facts gathered via AdminClient, mapped to a ConsumerGroupDto by the Normalizer. */
public record ConsumerGroupInfo(
        String groupId,
        String state,
        int memberCount,
        Integer coordinatorId,
        List<String> topics,
        Long totalLag
) {}
