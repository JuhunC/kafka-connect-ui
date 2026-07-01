package com.connectlens.inference;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.regex.Pattern;

/**
 * Maps a connector's {@code connector.class} + config to the external system it links to.
 * This is the zero-config engine behind the topology graph. Best-effort: unmatched connectors
 * still resolve to a "generic" system if any endpoint-like config key is present, else null.
 */
@Component
public class EndpointInferrer {

    private static final Pattern GENERIC_ENDPOINT_KEY =
            Pattern.compile("(?i).*(connection\\.url|\\.url|hosts?|\\.uri|bucket).*");

    public InferredSystem infer(String connectorClass, String type, Map<String, String> config) {
        if (config == null) config = Map.of();
        String cls = connectorClass == null ? "" : connectorClass;
        String role = roleFor(cls, type);

        // Debezium Postgres
        if (cls.contains("debezium") && cls.toLowerCase().contains("postgres")) {
            String host = firstNonBlank(config.get("database.hostname"), config.get("topic.prefix"), "postgres");
            String port = config.getOrDefault("database.port", "5432");
            String db = config.getOrDefault("database.dbname", "");
            String endpoint = host + ":" + port + (db.isBlank() ? "" : "/" + db);
            return new InferredSystem("postgres:" + host + ":" + port, "postgres",
                    "Postgres " + host, endpoint, "source");
        }
        // Debezium MySQL
        if (cls.contains("debezium") && cls.toLowerCase().contains("mysql")) {
            String host = firstNonBlank(config.get("database.hostname"), "mysql");
            String port = config.getOrDefault("database.port", "3306");
            return new InferredSystem("mysql:" + host + ":" + port, "mysql",
                    "MySQL " + host, host + ":" + port, "source");
        }
        // Splunk sink
        if (cls.toLowerCase().contains("splunk")) {
            String uri = firstNonBlank(config.get("splunk.hec.uri"), config.get("splunk.hec.raw.endpoint"), "");
            String host = hostOf(uri);
            return new InferredSystem("splunk:" + slug(host, uri), "splunk",
                    "Splunk " + firstNonBlank(host, uri), blankToNull(uri), "sink");
        }
        // Elasticsearch / OpenSearch
        if (cls.toLowerCase().contains("elasticsearch") || cls.toLowerCase().contains("opensearch")) {
            String url = firstNonBlank(config.get("connection.url"), config.get("connection.hosts"), "");
            String kind = cls.toLowerCase().contains("opensearch") ? "opensearch" : "elasticsearch";
            return new InferredSystem(kind + ":" + slug(hostOf(url), url), kind,
                    capitalize(kind) + " " + firstNonBlank(hostOf(url), url), blankToNull(url), "sink");
        }
        // S3
        if (cls.toLowerCase().contains("s3")) {
            String bucket = firstNonBlank(config.get("s3.bucket.name"), config.get("s3.bucket"), "");
            return new InferredSystem("s3:" + slug(bucket, bucket), "s3",
                    "S3 " + firstNonBlank(bucket, "bucket"), bucket.isBlank() ? null : "s3://" + bucket, "sink");
        }
        // GCS
        if (cls.toLowerCase().contains("gcs")) {
            String bucket = firstNonBlank(config.get("gcs.bucket.name"), "");
            return new InferredSystem("gcs:" + slug(bucket, bucket), "gcs",
                    "GCS " + firstNonBlank(bucket, "bucket"), bucket.isBlank() ? null : "gs://" + bucket, "sink");
        }
        // Generic JDBC
        if (cls.toLowerCase().contains("jdbc") || config.containsKey("connection.url")) {
            String url = firstNonBlank(config.get("connection.url"), "");
            String host = hostOf(url);
            return new InferredSystem("jdbc:" + slug(host, url), "jdbc",
                    "JDBC " + firstNonBlank(host, "database"), blankToNull(url), role);
        }
        // Fallback: any endpoint-like config key
        for (Map.Entry<String, String> e : config.entrySet()) {
            if (GENERIC_ENDPOINT_KEY.matcher(e.getKey()).matches() && e.getValue() != null && !e.getValue().isBlank()) {
                String v = e.getValue();
                String host = hostOf(v);
                return new InferredSystem("generic:" + slug(host, v), "generic",
                        firstNonBlank(host, v), v, role);
            }
        }
        return null;
    }

    private static String roleFor(String cls, String type) {
        String lower = cls.toLowerCase();
        if (lower.endsWith("sinkconnector") || lower.contains("sink")) return "sink";
        if (lower.endsWith("sourceconnector") || lower.contains("source")) return "source";
        if ("source".equals(type) || "sink".equals(type)) return type;
        return "unknown";
    }

    /** Extract a host from a URL, JDBC string, or host:port. */
    static String hostOf(String value) {
        if (value == null || value.isBlank()) return "";
        String v = value.trim();
        int jdbc = v.indexOf("jdbc:");
        if (jdbc >= 0) {
            // jdbc:postgresql://host:5432/db
            int slashSlash = v.indexOf("//");
            if (slashSlash >= 0) v = v.substring(slashSlash + 2);
        } else {
            int scheme = v.indexOf("://");
            if (scheme >= 0) v = v.substring(scheme + 3);
        }
        // strip user@ , path, port
        int at = v.indexOf('@');
        if (at >= 0) v = v.substring(at + 1);
        int slash = v.indexOf('/');
        if (slash >= 0) v = v.substring(0, slash);
        int colon = v.indexOf(':');
        if (colon >= 0) v = v.substring(0, colon);
        int comma = v.indexOf(',');
        if (comma >= 0) v = v.substring(0, comma);
        return v;
    }

    private static String slug(String preferred, String fallback) {
        String base = (preferred != null && !preferred.isBlank()) ? preferred : fallback;
        if (base == null) base = "unknown";
        String s = base.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("(^-|-$)", "");
        return s.isBlank() ? "unknown" : s;
    }

    private static String firstNonBlank(String... vals) {
        for (String v : vals) if (v != null && !v.isBlank()) return v;
        return "";
    }

    private static String blankToNull(String v) {
        return (v == null || v.isBlank()) ? null : v;
    }

    private static String capitalize(String s) {
        return s.isEmpty() ? s : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }
}
