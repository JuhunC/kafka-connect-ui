package com.connectlens.poller;

import com.connectlens.kafka.TopicInfo;
import com.connectlens.model.Health;
import com.connectlens.model.TaskDto;
import com.connectlens.model.TopicDto;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class NormalizerLogicTest {

    @Test
    void failedTaskWinsRollup() {
        // A RUNNING connector with one FAILED task must roll up to FAILED (KAFKA-9066 discipline:
        // health comes from /status, never from a missing metric).
        List<TaskDto> tasks = List.of(
                new TaskDto(0, Health.RUNNING, "w1", null),
                new TaskDto(1, Health.FAILED, "w1", "boom"));
        assertThat(Normalizer.rollup(Health.RUNNING, tasks)).isEqualTo(Health.FAILED);
    }

    @Test
    void allRunningRollsUpRunning() {
        assertThat(Normalizer.rollup(Health.RUNNING, List.of(new TaskDto(0, Health.RUNNING, "w", null))))
                .isEqualTo(Health.RUNNING);
    }

    @Test
    void unassignedTaskIsDegraded() {
        assertThat(Normalizer.rollup(Health.RUNNING, List.of(new TaskDto(0, Health.UNASSIGNED, null, null))))
                .isEqualTo(Health.DEGRADED);
    }

    @Test
    void pausedAndStoppedPreserved() {
        assertThat(Normalizer.rollup(Health.PAUSED, List.of())).isEqualTo(Health.PAUSED);
        assertThat(Normalizer.rollup(Health.STOPPED, List.of())).isEqualTo(Health.STOPPED);
    }

    @Test
    void secretsAreMasked() {
        Map<String, String> masked = Normalizer.maskConfig(Map.of(
                "splunk.hec.token", "abc123",
                "database.password", "pw",
                "topics", "app.events"));
        assertThat(masked.get("splunk.hec.token")).isEqualTo("********");
        assertThat(masked.get("database.password")).isEqualTo("********");
        assertThat(masked.get("topics")).isEqualTo("app.events");
    }

    @Test
    void maskingCoversCredentialsWithoutOverMasking() {
        Map<String, String> masked = Normalizer.maskConfig(Map.of(
                "key.converter", "org.apache.kafka.connect.json.JsonConverter",
                "value.converter", "org.apache.kafka.connect.json.JsonConverter",
                "sasl.jaas.config", "PlainLoginModule required username=\"u\" password=\"p\";",
                "consumer.override.sasl.jaas.config", "x",
                "aws.secret.access.key", "AKIAEXAMPLE",
                "http.headers.Authorization", "Bearer xyz",
                "connection.url", "jdbc:postgresql://user:pw@db:5432/app",
                "topics", "app.events"));
        // Public config must NOT be over-masked (regression: bare \\bkey\\b masked key.converter):
        assertThat(masked.get("key.converter")).isEqualTo("org.apache.kafka.connect.json.JsonConverter");
        assertThat(masked.get("value.converter")).isEqualTo("org.apache.kafka.connect.json.JsonConverter");
        assertThat(masked.get("topics")).isEqualTo("app.events");
        // Real credentials must be masked, by key name or by value content:
        assertThat(masked.get("sasl.jaas.config")).isEqualTo("********");
        assertThat(masked.get("consumer.override.sasl.jaas.config")).isEqualTo("********");
        assertThat(masked.get("aws.secret.access.key")).isEqualTo("********");
        assertThat(masked.get("http.headers.Authorization")).isEqualTo("********");
        assertThat(masked.get("connection.url")).isEqualTo("********");
    }

    @Test
    void consumerGroupStateMapsToHealth() {
        assertThat(Normalizer.consumerGroupHealth("Stable")).isEqualTo(Health.RUNNING);
        assertThat(Normalizer.consumerGroupHealth("Empty")).isEqualTo(Health.PAUSED);
        assertThat(Normalizer.consumerGroupHealth("Dead")).isEqualTo(Health.FAILED);
        assertThat(Normalizer.consumerGroupHealth("PreparingRebalance")).isEqualTo(Health.RESTARTING);
        assertThat(Normalizer.consumerGroupHealth("CompletingRebalance")).isEqualTo(Health.RESTARTING);
        assertThat(Normalizer.consumerGroupHealth("Unknown")).isEqualTo(Health.UNKNOWN);
        assertThat(Normalizer.consumerGroupHealth(null)).isEqualTo(Health.UNKNOWN);
    }

    @Test
    void topicStateFromLastProduced() {
        long now = 1_000_000_000L;
        long window = 300_000L;
        TopicDto active = Normalizer.mapTopic(new TopicInfo("t1", 3, 100, now - 1_000), now, window);
        assertThat(active.state()).isEqualTo("ACTIVE");
        assertThat(active.health()).isEqualTo(Health.RUNNING);

        TopicDto idle = Normalizer.mapTopic(new TopicInfo("t2", 1, 50, now - 600_000), now, window);
        assertThat(idle.state()).isEqualTo("IDLE");
        assertThat(idle.health()).isEqualTo(Health.DEGRADED);

        TopicDto empty = Normalizer.mapTopic(new TopicInfo("t3", 1, 0, null), now, window);
        assertThat(empty.state()).isEqualTo("EMPTY");
        assertThat(empty.health()).isEqualTo(Health.PAUSED);
    }

    @Test
    void parseHealthDefaultsToUnknown() {
        assertThat(Normalizer.parseHealth("weird")).isEqualTo(Health.UNKNOWN);
        assertThat(Normalizer.parseHealth(null)).isEqualTo(Health.UNKNOWN);
        assertThat(Normalizer.parseHealth("running")).isEqualTo(Health.RUNNING);
    }
}
