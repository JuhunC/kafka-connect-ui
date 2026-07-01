package com.connectlens.poller;

import com.connectlens.connect.RawConnector;
import com.connectlens.connect.RawTask;
import com.connectlens.inference.EndpointInferrer;
import com.connectlens.inference.InferredSystem;
import com.connectlens.model.*;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Turns raw Connect data into the wire model: connectors, per-connector detail, external systems,
 * and topology. Health always derives from REST /status (never from a missing metric — KAFKA-9066).
 */
@Component
public class Normalizer {

    private static final Pattern SECRET_KEY =
            Pattern.compile("(?i).*(password|secret|token|credential|passphrase|private|\\bkey\\b|\\.key$).*");
    private static final String MASK = "********";

    private final EndpointInferrer inferrer;

    public Normalizer(EndpointInferrer inferrer) {
        this.inferrer = inferrer;
    }

    public NormalizedResult normalize(String clusterId,
                                      Map<String, RawConnector> raw,
                                      Map<String, LagDto> lagByConnector,
                                      boolean kafkaReachable,
                                      long nowTs) {
        List<ConnectorDto> connectors = new ArrayList<>();
        Map<String, ConnectorDetailDto> details = new LinkedHashMap<>();
        Map<String, SysAgg> systemsById = new LinkedHashMap<>();

        for (RawConnector rc : raw.values()) {
            List<TaskDto> tasks = new ArrayList<>();
            for (RawTask t : rc.tasks()) {
                tasks.add(new TaskDto(t.id(), parseHealth(t.state()), t.workerId(), t.trace()));
            }
            Health connectorState = parseHealth(rc.connectorState());
            Health health = rollup(connectorState, tasks);
            String type = rc.type() == null ? "unknown" : rc.type();

            List<String> topics = parseTopics(rc.config());
            InferredSystem sys = inferrer.infer(rc.connectorClass(), type, rc.config());
            String externalSystemId = sys == null ? null : sys.id();
            LagDto lag = "sink".equals(type) && lagByConnector != null ? lagByConnector.get(rc.name()) : null;

            long failed = tasks.stream().filter(t -> t.state() == Health.FAILED).count();
            ConnectorDto dto = new ConnectorDto(
                    rc.name(), rc.connectorClass(), type, connectorState, health, rc.workerId(),
                    tasks.size(), (int) failed, tasks, topics, externalSystemId, lag);
            connectors.add(dto);
            details.put(rc.name(), new ConnectorDetailDto(dto, maskConfig(rc.config())));

            if (sys != null) {
                systemsById.computeIfAbsent(sys.id(), k -> new SysAgg(sys))
                        .add(rc.name(), health);
            }
        }

        List<ExternalSystemDto> systems = new ArrayList<>();
        for (SysAgg agg : systemsById.values()) {
            Reachability reach = reachabilityProxy(agg.health);
            Long lastSuccess = reach == Reachability.REACHABLE ? nowTs : null;
            systems.add(new ExternalSystemDto(
                    agg.sys.id(), agg.sys.kind(), agg.sys.displayName(), agg.sys.endpoint(), agg.sys.role(),
                    reach, lastSuccess, List.copyOf(agg.connectors), agg.health));
        }

        TopologyDto topology = buildTopology(clusterId, connectors, systemsById, kafkaReachable);
        return new NormalizedResult(connectors, details, systems, topology);
    }

    private TopologyDto buildTopology(String clusterId, List<ConnectorDto> connectors,
                                      Map<String, SysAgg> systemsById, boolean kafkaReachable) {
        List<TopologyNodeDto> nodes = new ArrayList<>();
        List<TopologyEdgeDto> edges = new ArrayList<>();

        String hubId = "kafka:" + clusterId;
        nodes.add(new TopologyNodeDto(hubId, "kafka", "Kafka", clusterId, "hub",
                kafkaReachable ? Health.RUNNING : Health.FAILED, null));

        for (SysAgg agg : systemsById.values()) {
            nodes.add(new TopologyNodeDto(agg.sys.id(), "external", agg.sys.displayName(),
                    agg.sys.endpoint() == null ? agg.sys.kind() : agg.sys.endpoint(),
                    agg.sys.role(), agg.health, agg.sys.kind()));
        }

        for (ConnectorDto c : connectors) {
            if (c.externalSystemId() == null) continue;
            boolean sink = "sink".equals(c.type());
            String source = sink ? hubId : c.externalSystemId();
            String target = sink ? c.externalSystemId() : hubId;
            edges.add(new TopologyEdgeDto("edge:" + c.name(), source, target, c.name(), c.health(),
                    sink ? "out" : "in"));
        }
        return new TopologyDto(nodes, edges);
    }

    // ---- rollup / parsing helpers ------------------------------------------

    static Health parseHealth(String state) {
        if (state == null) return Health.UNKNOWN;
        try {
            return Health.valueOf(state.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return Health.UNKNOWN;
        }
    }

    /** Connector health = worst task state, honoring connector-level PAUSED/STOPPED. */
    static Health rollup(Health connectorState, List<TaskDto> tasks) {
        boolean anyFailed = tasks.stream().anyMatch(t -> t.state() == Health.FAILED);
        boolean anyUnassigned = tasks.stream().anyMatch(t -> t.state() == Health.UNASSIGNED);
        boolean anyRestarting = tasks.stream().anyMatch(t -> t.state() == Health.RESTARTING);
        boolean allRunning = !tasks.isEmpty() && tasks.stream().allMatch(t -> t.state() == Health.RUNNING);

        if (anyFailed || connectorState == Health.FAILED) return Health.FAILED;
        if (connectorState == Health.PAUSED) return Health.PAUSED;
        if (connectorState == Health.STOPPED) return Health.STOPPED;
        if (anyUnassigned || connectorState == Health.UNASSIGNED) return Health.DEGRADED;
        if (anyRestarting || connectorState == Health.RESTARTING) return Health.RESTARTING;
        if (allRunning) return Health.RUNNING;
        if (connectorState == Health.RUNNING && tasks.isEmpty()) return Health.RUNNING;
        return Health.UNKNOWN;
    }

    static Reachability reachabilityProxy(Health h) {
        return switch (h) {
            case RUNNING -> Reachability.REACHABLE;
            case FAILED -> Reachability.UNREACHABLE;
            case DEGRADED, UNASSIGNED, RESTARTING -> Reachability.DEGRADED;
            default -> Reachability.UNKNOWN;
        };
    }

    private static int severity(Health h) {
        return switch (h) {
            case FAILED -> 6;
            case UNASSIGNED, DEGRADED -> 5;
            case RESTARTING -> 4;
            case UNKNOWN -> 3;
            case PAUSED, STOPPED -> 2;
            case RUNNING -> 1;
        };
    }

    static Health worse(Health a, Health b) {
        return severity(a) >= severity(b) ? a : b;
    }

    private static List<String> parseTopics(Map<String, String> config) {
        String topics = config.get("topics");
        if (topics == null || topics.isBlank()) {
            String regex = config.get("topics.regex");
            return regex == null ? List.of() : List.of("~" + regex);
        }
        List<String> out = new ArrayList<>();
        for (String t : topics.split(",")) {
            if (!t.isBlank()) out.add(t.trim());
        }
        return out;
    }

    static Map<String, String> maskConfig(Map<String, String> config) {
        Map<String, String> out = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : config.entrySet()) {
            out.put(e.getKey(), SECRET_KEY.matcher(e.getKey()).matches() ? MASK : e.getValue());
        }
        return out;
    }

    /** Aggregates connectors that point at the same external system. */
    private static final class SysAgg {
        final InferredSystem sys;
        final List<String> connectors = new ArrayList<>();
        Health health = Health.UNKNOWN;
        boolean first = true;

        SysAgg(InferredSystem sys) { this.sys = sys; }

        void add(String connectorName, Health h) {
            connectors.add(connectorName);
            health = first ? h : worse(health, h);
            first = false;
        }
    }
}
