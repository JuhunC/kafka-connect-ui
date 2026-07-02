package com.connectlens.inference;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EndpointInferrerTest {

    private final EndpointInferrer inferrer = new EndpointInferrer();

    @Test
    void splunkSink() {
        InferredSystem s = inferrer.infer(
                "com.splunk.kafka.connect.SplunkSinkConnector", "sink",
                Map.of("splunk.hec.uri", "https://splunk:8088", "splunk.hec.token", "secret"));
        assertThat(s).isNotNull();
        assertThat(s.kind()).isEqualTo("splunk");
        assertThat(s.role()).isEqualTo("sink");
        assertThat(s.endpoint()).isEqualTo("https://splunk:8088");
        assertThat(s.id()).startsWith("splunk:");
    }

    @Test
    void debeziumPostgresSource() {
        InferredSystem s = inferrer.infer(
                "io.debezium.connector.postgresql.PostgresConnector", "source",
                Map.of("database.hostname", "postgres", "database.port", "5432", "database.dbname", "inventory"));
        assertThat(s).isNotNull();
        assertThat(s.kind()).isEqualTo("postgres");
        assertThat(s.role()).isEqualTo("source");
        assertThat(s.endpoint()).isEqualTo("postgres:5432/inventory");
    }

    @Test
    void genericFallbackOnConnectionUrl() {
        InferredSystem s = inferrer.infer(
                "com.example.WeirdSinkConnector", "sink",
                Map.of("connection.url", "http://foo:9000"));
        assertThat(s).isNotNull();
        assertThat(s.endpoint()).isEqualTo("http://foo:9000");
    }

    @Test
    void noEndpointYieldsNull() {
        InferredSystem s = inferrer.infer("com.example.NoopConnector", "source", Map.of("foo", "bar"));
        assertThat(s).isNull();
    }

    @Test
    void sanitizeEndpointStripsCredentials() {
        assertThat(EndpointInferrer.sanitizeEndpoint("mongodb://user:pass@host:27017/db"))
                .isEqualTo("mongodb://host:27017/db");
        assertThat(EndpointInferrer.sanitizeEndpoint("https://user:token@es:9200"))
                .isEqualTo("https://es:9200");
        assertThat(EndpointInferrer.sanitizeEndpoint("jdbc:postgresql://h:5432/db?user=x&password=y"))
                .isEqualTo("jdbc:postgresql://h:5432/db");
        assertThat(EndpointInferrer.sanitizeEndpoint("https://splunk:8088")).isEqualTo("https://splunk:8088");
    }

    @Test
    void inferredEndpointHasNoEmbeddedCredentials() {
        InferredSystem s = inferrer.infer(
                "io.confluent.connect.jdbc.JdbcSinkConnector", "sink",
                Map.of("connection.url", "jdbc:postgresql://svc:secretpw@db:5432/app"));
        assertThat(s).isNotNull();
        assertThat(s.endpoint()).doesNotContain("secretpw");
        assertThat(s.endpoint()).doesNotContain("svc:");
    }

    @Test
    void hostParsingHandlesJdbcAndScheme() {
        assertThat(EndpointInferrer.hostOf("jdbc:postgresql://db-host:5432/app")).isEqualTo("db-host");
        assertThat(EndpointInferrer.hostOf("https://user@es-host:9200/index")).isEqualTo("es-host");
    }
}
