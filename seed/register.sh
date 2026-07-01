#!/bin/sh
# ConnectLens seed — idempotent connector registration.
#
# Uses `PUT /connectors/{name}/config` which creates-or-updates, so re-running
# is safe (no 409s, converges to the file contents). Each *.json in /seed is the
# flat config map that endpoint expects.
#
# Registers:
#   pg-inventory-source   Debezium Postgres CDC source  (public.customers)
#   splunk-events-sink    Splunk HEC sink for the CDC topic
#   splunk-broken-sink    intentionally broken sink -> shows FAILED on the graph
#
# Runs only after connect/postgres/splunk are healthy (see compose depends_on),
# but still waits/retries on the Connect REST API to be safe.
set -eu

CONNECT_URL="${CONNECT_URL:-http://connect:8083}"

log() { echo "[seed] $*"; }

# --- wait for the Connect REST API ------------------------------------------
log "waiting for Connect REST at ${CONNECT_URL} ..."
i=0
until curl -sf -o /dev/null "${CONNECT_URL}/connectors"; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
        log "ERROR: Connect REST not reachable after ~5m, giving up"
        exit 1
    fi
    sleep 5
done
log "Connect REST is up."

# put_connector NAME FILE  -> idempotent PUT of the config, with retry
put_connector() {
    name="$1"
    file="$2"
    log "registering '${name}' from ${file}"

    attempt=0
    while true; do
        attempt=$((attempt + 1))
        code=$(curl -s -o /tmp/seed_resp.json -w '%{http_code}' \
            -X PUT \
            -H 'Content-Type: application/json' \
            --data @"${file}" \
            "${CONNECT_URL}/connectors/${name}/config")

        # 200 (updated) / 201 (created) are success.
        if [ "$code" = "200" ] || [ "$code" = "201" ]; then
            log "  -> OK (${code}) ${name}"
            return 0
        fi

        # 409 = rebalance in progress; retry a few times.
        if [ "$code" = "409" ] && [ "$attempt" -lt 10 ]; then
            log "  -> 409 rebalancing, retrying (${attempt}) ..."
            sleep 5
            continue
        fi

        if [ "$attempt" -lt 5 ]; then
            log "  -> HTTP ${code}, retrying (${attempt}) ..."
            sleep 5
            continue
        fi

        log "  -> FAILED (${code}) for ${name}:"
        cat /tmp/seed_resp.json 2>/dev/null || true
        echo
        # The broken connector is expected to accept config but fail at runtime;
        # a non-2xx here is a real problem, but we keep going so the other
        # connectors still land.
        return 1
    done
}

rc=0
put_connector "pg-inventory-source" "/seed/pg-inventory-source.json" || rc=1
put_connector "splunk-events-sink"  "/seed/splunk-events-sink.json"  || rc=1
put_connector "splunk-broken-sink"  "/seed/splunk-broken-sink.json"  || rc=1

log "current connectors:"
curl -s "${CONNECT_URL}/connectors" || true
echo

if [ "$rc" -ne 0 ]; then
    log "one or more connectors failed to register (see above)."
else
    log "all connectors registered."
fi
exit "$rc"
