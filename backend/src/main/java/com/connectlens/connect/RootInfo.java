package com.connectlens.connect;

/** The Connect worker root response: version + the Kafka cluster id it is attached to. */
public record RootInfo(String version, String kafkaClusterId) {}
