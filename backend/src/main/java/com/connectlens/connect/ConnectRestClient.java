package com.connectlens.connect;

import com.connectlens.error.ConnectConflictException;
import com.connectlens.error.ConnectUnavailableException;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin client over the Kafka Connect REST API. All methods take the connect base URL so a single
 * client instance serves every configured cluster. Read failures surface as
 * {@link ConnectUnavailableException}; a 409 on an action surfaces as {@link ConnectConflictException}.
 */
@Component
public class ConnectRestClient {

    private static final Logger log = LoggerFactory.getLogger(ConnectRestClient.class);

    private final RestClient rest;

    public ConnectRestClient(RestClient connectHttpClient) {
        this.rest = connectHttpClient;
    }

    /** Primary poll: one call returns config + status + tasks for every connector (KIP-465). */
    public Map<String, RawConnector> listConnectors(String base) {
        JsonNode body;
        try {
            body = rest.get()
                    .uri(base + "/connectors?expand=status&expand=info")
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            // Older Connect (<2.3) or a proxy may reject expand; fall back to the plain list.
            log.debug("expand query failed ({}), falling back to per-connector fetch", e.getStatusCode());
            return listConnectorsFallback(base);
        } catch (Exception e) {
            throw new ConnectUnavailableException("Connect unreachable at " + base, e);
        }
        if (body == null) {
            return Map.of();
        }
        if (body.isArray()) {
            // Server ignored expand and returned a name array.
            return listConnectorsFallback(base);
        }
        Map<String, RawConnector> result = new LinkedHashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = body.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> e = fields.next();
            String name = e.getKey();
            JsonNode node = e.getValue();
            result.put(name, parseExpanded(name, node.get("info"), node.get("status")));
        }
        return result;
    }

    private Map<String, RawConnector> listConnectorsFallback(String base) {
        JsonNode names;
        try {
            names = rest.get().uri(base + "/connectors").retrieve().body(JsonNode.class);
        } catch (Exception e) {
            throw new ConnectUnavailableException("Connect unreachable at " + base, e);
        }
        Map<String, RawConnector> result = new LinkedHashMap<>();
        if (names == null || !names.isArray()) {
            return result;
        }
        for (JsonNode n : names) {
            String name = n.asText();
            JsonNode status = safeGet(base + "/connectors/" + enc(name) + "/status");
            JsonNode config = safeGet(base + "/connectors/" + enc(name) + "/config");
            JsonNode info = config == null ? null : wrapConfig(config);
            result.put(name, parseExpanded(name, info, status));
        }
        return result;
    }

    private JsonNode safeGet(String uri) {
        try {
            return rest.get().uri(uri).retrieve().body(JsonNode.class);
        } catch (Exception e) {
            return null;
        }
    }

    private JsonNode wrapConfig(JsonNode configObject) {
        // Present a plain /config response the same way the expand=info block looks.
        com.fasterxml.jackson.databind.node.ObjectNode wrapper =
                com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        wrapper.set("config", configObject);
        return wrapper;
    }

    private RawConnector parseExpanded(String name, JsonNode info, JsonNode status) {
        Map<String, String> config = new LinkedHashMap<>();
        if (info != null && info.has("config") && info.get("config").isObject()) {
            Iterator<Map.Entry<String, JsonNode>> it = info.get("config").fields();
            while (it.hasNext()) {
                Map.Entry<String, JsonNode> c = it.next();
                config.put(c.getKey(), c.getValue().asText());
            }
        }
        String connectorClass = config.get("connector.class");

        String type = text(status, "type");
        if (type == null) type = text(info, "type");
        if (type == null) type = "unknown";

        String connectorState = null;
        String workerId = null;
        List<RawTask> tasks = new ArrayList<>();
        if (status != null) {
            JsonNode conn = status.get("connector");
            if (conn != null) {
                connectorState = text(conn, "state");
                workerId = text(conn, "worker_id");
            }
            JsonNode taskArr = status.get("tasks");
            if (taskArr != null && taskArr.isArray()) {
                for (JsonNode t : taskArr) {
                    tasks.add(new RawTask(
                            t.path("id").asInt(),
                            text(t, "state"),
                            text(t, "worker_id"),
                            text(t, "trace")));
                }
            }
        }
        return new RawConnector(name, type, connectorClass, config, connectorState, workerId, tasks);
    }

    public RootInfo getRoot(String base) {
        try {
            JsonNode n = rest.get().uri(base + "/").retrieve().body(JsonNode.class);
            if (n == null) return new RootInfo(null, null);
            return new RootInfo(text(n, "version"), text(n, "kafka_cluster_id"));
        } catch (Exception e) {
            throw new ConnectUnavailableException("Connect root unreachable at " + base, e);
        }
    }

    // ---- Lifecycle actions --------------------------------------------------

    public void pause(String base, String name) {
        action(() -> rest.put().uri(base + "/connectors/" + enc(name) + "/pause").retrieve().toBodilessEntity(), name);
    }

    public void resume(String base, String name) {
        action(() -> rest.put().uri(base + "/connectors/" + enc(name) + "/resume").retrieve().toBodilessEntity(), name);
    }

    public void restart(String base, String name) {
        action(() -> rest.post().uri(base + "/connectors/" + enc(name) + "/restart").retrieve().toBodilessEntity(), name);
    }

    public void restartFailed(String base, String name) {
        String uri = UriComponentsBuilder.fromUriString(base + "/connectors/" + enc(name) + "/restart")
                .queryParam("includeTasks", "true")
                .queryParam("onlyFailed", "true")
                .toUriString();
        action(() -> rest.post().uri(uri).retrieve().toBodilessEntity(), name);
    }

    public void restartTask(String base, String name, int taskId) {
        action(() -> rest.post().uri(base + "/connectors/" + enc(name) + "/tasks/" + taskId + "/restart")
                .retrieve().toBodilessEntity(), name);
    }

    private void action(Runnable call, String name) {
        try {
            call.run();
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 409) {
                throw new ConnectConflictException("Connector '" + name + "' is rebalancing");
            }
            throw new ConnectUnavailableException("Connect action failed for '" + name + "': " + e.getStatusText(), e);
        } catch (Exception e) {
            throw new ConnectUnavailableException("Connect action failed for '" + name + "'", e);
        }
    }

    private static String text(JsonNode node, String field) {
        if (node == null) return null;
        JsonNode v = node.get(field);
        return (v == null || v.isNull()) ? null : v.asText();
    }

    private static String enc(String name) {
        return org.springframework.web.util.UriUtils.encodePathSegment(name, java.nio.charset.StandardCharsets.UTF_8);
    }
}
