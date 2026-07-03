# ConnectLens

[![CI](https://github.com/JuhunC/kafka-connect-ui/actions/workflows/ci.yml/badge.svg)](https://github.com/JuhunC/kafka-connect-ui/actions/workflows/ci.yml)
[![Release](https://github.com/JuhunC/kafka-connect-ui/actions/workflows/release.yml/badge.svg)](https://github.com/JuhunC/kafka-connect-ui/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A self-hostable, real-time monitoring **and** control plane for Apache Kafka + Kafka Connect,
deployable with a single `docker compose up`. Its headline feature is a **live "connected
systems" topology**: Kafka sits at the center, connectors are animated directional edges, and the
**external systems your connectors bind to** — Postgres, Splunk, Elasticsearch, S3, JDBC, … — are
first-class, typed, health-bearing nodes. The purpose: *see every system linked to Kafka and Kafka
Connect on one screen.*

A Splunk sink node, for example, shows the Kafka cluster context **and** that system's own info
(HEC endpoint, reachability, throughput, error rate, last successful write) together.

> This repository implements **phases P0 + P1** of the [full plan](docs/CONTRACT.md) plus the P2
> topology differentiator: real-time status, multi-cluster support, OIDC/RBAC, the connected-systems
> topology, connector detail + lifecycle actions, and consumer-lag. Prometheus/Grafana history, DLQ
> message preview, and an outbound alert engine are on the roadmap (P3+).

---

## Architecture

```
Browser (React 19 SPA)  ──►  nginx  ──►  Backend aggregator (Spring Boot)  ──►  Kafka Connect REST
   topology · grid           /api            per-cluster poll loop            └►  Kafka AdminClient
   SSE live updates          /events         SSE broadcaster                       (metadata + lag)
        ▲                                     endpoint inferrer ──► external systems
        └──────────── OIDC login ──────────►  Keycloak
```

Browsers never talk to Kafka or Connect directly — one backend owns all upstream I/O, so upstream
load is O(clusters), not O(browsers). Each cluster has an isolated poll loop; a Connect failure
serves the last-good snapshot flagged `stale` rather than flipping connectors to FAILED.

Full technical contract (REST paths, DTO shapes, SSE format, inference rules): [docs/CONTRACT.md](docs/CONTRACT.md).

## Quick start

**Prerequisites:** Docker Desktop with **≥ 4 GB RAM allocated** (the Splunk demo container alone
uses ~2 GB), Docker Compose v2+.

```bash
docker compose up --build
```

**The demo runs with no authentication by default** — no Keycloak, no login, and every action
(pause / resume / restart connectors) is allowed. To run *with* auth (Keycloak + RBAC), opt in:

```bash
CONNECTLENS_AUTH_ENABLED=true docker compose --profile auth up --build
```

First run pulls large images (Splunk, Kafka Connect) and bakes the Debezium + Splunk plugins into
the Connect image, so it takes a few minutes. When it settles:

| URL | What |
|---|---|
| http://localhost:8080 | **ConnectLens UI** — no login (everyone is admin) |
| http://localhost:8081 | Keycloak admin (`admin` / `admin`) — only with `--profile auth` |
| http://localhost:8000 | Splunk web (`admin` / `Chang3d!`) |
| http://localhost:8083 | Kafka Connect REST |

The `seed` service registers a demo pipeline automatically:

- `pg-inventory-source` — Debezium captures changes from Postgres `inventory.public.customers`
- `splunk-events-sink` — streams those change events into Splunk over HEC
- `splunk-broken-sink` — a deliberately broken connector, so you can see a **FAILED** node and the
  error trace on the topology

A `datagen` container continuously inserts/updates rows so the pipeline flows and the topology edges
animate at live throughput.

### Run prebuilt images from GHCR (no local build)

Each tagged release publishes three images to GitHub Container Registry:

- `ghcr.io/juhunc/connectlens-backend`
- `ghcr.io/juhunc/connectlens-frontend`
- `ghcr.io/juhunc/connectlens-connect`

Pull the whole stack instead of building it (the overlay swaps the three custom services for their
GHCR images; Kafka/Postgres/Splunk/Keycloak still come from their public images):

```bash
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d
```

Or pull the images directly (the tag omits the leading `v` — `docker/metadata-action` strips it):

```bash
docker pull ghcr.io/juhunc/connectlens-backend:0.1.0
docker pull ghcr.io/juhunc/connectlens-frontend:0.1.0
docker pull ghcr.io/juhunc/connectlens-connect:0.1.0
```

Pin a specific version by editing the tags in `docker-compose.ghcr.yml` (e.g. `:0.1.0` instead of
`:latest`). The images are public, so no `docker login` is required.

### Run against your own Kafka / Connect (app-only)

To point ConnectLens at an **existing** Kafka + Kafka Connect instead of the bundled demo, use
[`docker-compose.app.yml`](docker-compose.app.yml). It starts only the app (backend + frontend from
GHCR) plus its bundled Keycloak — no Kafka, Connect, Postgres, or Splunk:

```bash
cp .env.app.example .env
# edit .env: set KAFKA_BOOTSTRAP and CONNECT_URL to your endpoints
docker compose -f docker-compose.app.yml up -d
# open http://localhost:8080   (admin / admin)
```

ConnectLens does **not** connect to Splunk / Elasticsearch / S3 / databases directly — it discovers
those sink/source systems through the Kafka Connect REST API and infers their health from connector
state. So the only endpoints it needs are your **Kafka bootstrap** and **Connect REST URL**.

- Endpoints must be reachable **from the backend container**: use `host.docker.internal:<port>` for
  services on your machine, or a real host/IP for a remote cluster.
- Your Kafka must advertise a listener the backend can resolve (not `localhost`).
- Add more clusters with `CONNECTLENS_CLUSTERS_1_*` env vars in the backend service.
- To use your own SSO instead of the bundled Keycloak, point the **backend** at it with `OIDC_ISSUER` /
  `OIDC_JWKS`, and point the **frontend** at it with `CONNECTLENS_OIDC_AUTHORITY` /
  `CONNECTLENS_OIDC_CLIENT_ID` — these are injected into the SPA at container start via a generated
  `/config.js`, so **no rebuild is needed** (image tag ≥ `0.1.1`).

### Authentication (off by default)

The main demo (`docker compose up`) runs **with no authentication**: Keycloak is gated behind the
`auth` profile and does not start, the backend runs open (every request is `ADMIN`), and the frontend
skips OIDC. So every connector action works immediately, no login. This is the recommended way to
try the demo.

Turn auth **on** (bundled Keycloak + RBAC) with the profile and flag together:

```bash
CONNECTLENS_AUTH_ENABLED=true docker compose --profile auth up --build
# open http://localhost:8080  (sign in — see Users and roles below)
```

For an **app-only** deployment against your *own* Kafka + Connect (no bundled Kafka/Connect/Splunk),
use [`docker-compose.noauth.yml`](docker-compose.noauth.yml) (no-auth) or
[`docker-compose.app.yml`](docker-compose.app.yml) (bundled Keycloak), or point the backend at your
own OIDC via `OIDC_ISSUER` / `OIDC_JWKS`.

## CI/CD

- **CI** (`.github/workflows/ci.yml`) runs on every push/PR to `main`: backend `mvn verify` (unit +
  Spring context tests), frontend type-check + build, and `docker compose config` validation.
- **Release** (`.github/workflows/release.yml`) runs when you push a semver tag — it builds all three
  images with Buildx (GHA layer cache) and pushes them to GHCR, then cuts a GitHub Release:

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

  You can also trigger it manually from the **Actions** tab (workflow_dispatch) with a tag input.

## Users and roles

**Only relevant when auth is enabled** (`--profile auth`). With the default no-auth demo there is no
login and every request is `ADMIN`, so all actions are allowed.

Under `--profile auth`, three demo users (Keycloak realm `connectlens`) map to RBAC roles:

| User | Password | Role | Can do |
|---|---|---|---|
| `viewer` | `viewer` | VIEWER | Read everything (the safe default) |
| `operator` | `operator` | OPERATOR | + pause / resume / restart connectors and tasks |
| `admin` | `admin` | ADMIN | Everything |

Read endpoints require authentication; **mutating actions require OPERATOR or ADMIN** and are
enforced at the API, not just hidden in the UI. Connector secrets are masked (`********`) before
they ever leave the backend.

## Multi-cluster

Point ConnectLens at more clusters by adding indexed env vars to the `backend` service:

```yaml
CONNECTLENS_CLUSTERS_1_ID: "staging"
CONNECTLENS_CLUSTERS_1_NAME: "Staging"
CONNECTLENS_CLUSTERS_1_BOOTSTRAP: "staging-kafka:9092"
CONNECTLENS_CLUSTERS_1_CONNECT: "http://staging-connect:8083"
```

Each cluster gets its own isolated poll loop and appears in the cluster switcher.

## Local development (without Docker)

Backend:
```bash
cd backend
mvn spring-boot:run     # http://localhost:8090  (point clusters at localhost via env)
mvn test                # unit + Spring context smoke tests
```

Frontend:
```bash
cd frontend
npm install
npm run dev             # http://localhost:5173, proxies /api to :8090
npm run build           # type-check + production build
```

For local dev you still need Keycloak (or another OIDC issuer) reachable at the configured issuer,
and a Kafka + Connect to point at — the compose stack is the easiest way to supply those.

## Project layout

```
backend/     Spring Boot aggregator (poller, Connect client, AdminClient, inference, SSE, OIDC/RBAC)
frontend/    React 19 + Vite + MUI + React Flow SPA (topology, grid, detail drawer, cluster panel)
connect/     Custom Kafka Connect image with Debezium PG + Splunk sink plugins baked in
keycloak/    Realm export: roles, PKCE client, demo users
seed/        Idempotent connector registration (working pipeline + a broken connector)
postgres/    Demo schema (wal_level=logical)
datagen/     Continuous INSERT/UPDATE load so the demo pipeline flows
docs/        CONTRACT.md — the cross-cutting source of truth
docker-compose.yml
```

## Troubleshooting

- **Splunk won't start / gets OOM-killed** → give Docker Desktop ≥ 4 GB. Splunk has a long boot
  (~90 s `start_period`); nothing downstream proceeds until its healthcheck passes.
- **Login fails / token rejected** → Keycloak mints tokens with issuer `http://localhost:8081/...`
  (what the browser sees) while the backend validates signatures via the in-network JWKS at
  `http://keycloak:8080/...`. Both must resolve; don't change one without the other.
- **Connect takes a while to be ready** → cold start is ~30–60 s (it creates internal topics and
  opens `:8083`). The healthcheck has a generous `start_period`; the seed job waits and retries.
- **A connector shows FAILED** → open its detail drawer for the task state and full error trace.
  `splunk-broken-sink` is failed on purpose for the demo.
- **Plugin download fails during build** → the Connect image downloads the Splunk connector from
  GitHub releases and Debezium via confluent-hub at build time; both need network access.

## What's implemented vs. roadmap

**Implemented (P0 + P1 + topology):** real-time per-connector status over SSE, multi-cluster,
OIDC/SSO + RBAC, the connected-systems topology, per-connector detail + config (masked) + lifecycle
actions, cluster health panel (URP / offline / controller), authoritative sink consumer-lag,
external-system inference + reachability, the KAFKA-9066 corroboration rule, transient-error
(409/5xx) handling with stale-snapshot serving, and a **Consumer Groups** view — Kafka consumer
groups shown as their own topology node kind (distinct from connectors, with Connect-owned
`connect-<sink>` groups deduped out) plus a dedicated tab with state, members, topics, and lag. A
**Topics** tab reports each topic's partitions, message count, and **last-produced timestamp** (so you
can see producers are healthy), and topology edges render **directional arrows** showing data flow.

**Roadmap (P3+):** jmx_exporter → Prometheus → Grafana history and sparklines, DLQ message preview,
an outbound alert engine (webhook/Slack/email) with hysteresis, config create/edit forms, direct
per-target health probes beyond the connector-state proxy, and horizontal scale-out.
