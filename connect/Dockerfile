# ConnectLens — Kafka Connect image with plugins baked in at build time.
#
# Plugins:
#   * Debezium Postgres source  (via confluent-hub)
#   * Splunk sink               (jar dropped into a dir on CONNECT_PLUGIN_PATH)
#
# The Splunk sink dir must line up with CONNECT_PLUGIN_PATH in docker-compose.yml:
#   /usr/share/connectlens-plugins/splunk-kafka-connect/
FROM confluentinc/cp-kafka-connect:7.6.0

# --- Debezium Postgres source ------------------------------------------------
# Installs under /usr/share/confluent-hub-components (already on the plugin path).
RUN confluent-hub install --no-prompt debezium/debezium-connector-postgresql:latest

# --- Splunk sink -------------------------------------------------------------
# Downloaded from the splunk/kafka-connect-splunk GitHub releases. Pinned so the
# build is reproducible; bump the version + URL together.
ARG SPLUNK_CONNECT_VERSION=v2.2.6
ARG SPLUNK_CONNECT_JAR_URL=https://github.com/splunk/kafka-connect-splunk/releases/download/v2.2.6/splunk-kafka-connect-v2.2.6.jar

USER root
RUN mkdir -p /usr/share/connectlens-plugins/splunk-kafka-connect \
 && curl -fSL "${SPLUNK_CONNECT_JAR_URL}" \
      -o /usr/share/connectlens-plugins/splunk-kafka-connect/splunk-kafka-connect.jar
USER appuser
