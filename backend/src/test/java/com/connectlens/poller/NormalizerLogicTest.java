package com.connectlens.poller;

import com.connectlens.model.Health;
import com.connectlens.model.TaskDto;
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
    void parseHealthDefaultsToUnknown() {
        assertThat(Normalizer.parseHealth("weird")).isEqualTo(Health.UNKNOWN);
        assertThat(Normalizer.parseHealth(null)).isEqualTo(Health.UNKNOWN);
        assertThat(Normalizer.parseHealth("running")).isEqualTo(Health.RUNNING);
    }
}
