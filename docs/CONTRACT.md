# ConnectLens — Cross-cutting Contract (source of truth)

This file pins every shape that crosses a boundary (backend ↔ frontend ↔ infra).
If you change something here, change it everywhere. Product name: **ConnectLens**.

## 0. Names, ports, versions

- Java: 17 · Spring Boot: 3.3.x · Maven. Base package: `com.connectlens`.
- Frontend: React 19 + TypeScript + Vite + MUI + `@xyflow/react` + TanStack Query + `react-oidc-context` + `@microsoft/fetch-event-source`.
- Node 20+ for build.

Service names (docker network `connectlens-net`) and ports:

| Service | Container port | Host port | Notes |
|---|---|---|---|
| kafka | 9092 (internal), 9094 (external) | 9094 | apache/kafka KRaft |
| connect | 8083 | 8083 | custom image, plugins baked |
| postgres | 5432 | 5432 | demo source, wal_level=logical |
| splunk | 8000 (web), 8088 (HEC), 8089 (mgmt) | 8000, 8088 | splunk/splunk demo sink |
| keycloak | 8080 | 8081 | OIDC IdP |
| backend | 8090 | 8090 | Spring Boot aggregator |
| frontend | 80 (nginx) | 8080 | React SPA + reverse proxy |

Frontend nginx reverse-proxies `/api` and `/api/clusters/*/events` to `http://backend:8090`.
Browser talks only to `http://localhost:8080`. Keycloak is reached by the browser at
`http://localhost:8081`; by the backend at `http://keycloak:8080`.

## 1. Auth (OIDC / Keycloak)

- Realm: `connectlens`. Realm roles: `viewer`, `operator`, `admin`.
- Public SPA client: `connectlens-frontend` (standard flow / PKCE, redirect `http://localhost:8080/*`, web origins `http://localhost:8080`).
- Demo users: `admin`/`admin` (roles: admin), `operator`/`operator` (operator), `viewer`/`viewer` (viewer).
- Token roles live in `realm_access.roles`. Backend maps them to Spring authorities `ROLE_VIEWER`, `ROLE_OPERATOR`, `ROLE_ADMIN`.
- **Issuer/hostname split:** tokens carry issuer `http://localhost:8081/realms/connectlens` (what the browser sees). The backend validates signature via JWKS at `http://keycloak:8080/realms/connectlens/protocol/openid-connect/certs` and accepts that issuer. Configure the backend with an explicit `jwk-set-uri` (internal) + a custom issuer validator for `http://localhost:8081/realms/connectlens`. Keycloak started with `KC_HOSTNAME=http://localhost:8081` (or `--hostname-url`) so it mints that issuer.

Authorization rules (backend):
- `GET /api/health` — public.
- All other `/api/**` — authenticated (any role).
- Mutating connector actions (pause/resume/restart/task-restart) — `ROLE_OPERATOR` or `ROLE_ADMIN`.

Frontend OIDC config: authority `http://localhost:8081/realms/connectlens`, client_id `connectlens-frontend`, redirect_uri `http://localhost:8080`, response_type `code`, scope `openid profile`. Send `Authorization: Bearer <access_token>` on every `/api` call and on the SSE request (via fetch-event-source).

## 2. Cluster registry (backend config)

Bound from config/env, prefix `connectlens.clusters`. Each entry:
```
connectlens.clusters[0].id=local
connectlens.clusters[0].name=Local Dev
connectlens.clusters[0].bootstrap-servers=kafka:9092
connectlens.clusters[0].connect-url=http://connect:8083
```
Env form (Spring relaxed binding): `CONNECTLENS_CLUSTERS_0_ID`, `CONNECTLENS_CLUSTERS_0_NAME`,
`CONNECTLENS_CLUSTERS_0_BOOTSTRAP__SERVERS`, `CONNECTLENS_CLUSTERS_0_CONNECT__URL`.
Multi-cluster: increment the index. Poll cadence config: `connectlens.poll.fast-interval-ms` (default 4000),
`connectlens.poll.slow-interval-ms` (default 30000).

## 3. REST API (backend, all JSON, base `/api`)

| Method | Path | Auth | Returns |
|---|---|---|---|
| GET | `/api/health` | public | `{status:"UP"}` |
| GET | `/api/me` | auth | `MeDto` |
| GET | `/api/clusters` | auth | `ClusterSummaryDto[]` |
| GET | `/api/clusters/{clusterId}/snapshot` | auth | `ClusterSnapshotDto` |
| GET | `/api/clusters/{clusterId}/connectors/{name}` | auth | `ConnectorDetailDto` |
| GET | `/api/clusters/{clusterId}/events` | auth | SSE `text/event-stream` |
| POST | `/api/clusters/{clusterId}/connectors/{name}/pause` | operator | 202 |
| POST | `/api/clusters/{clusterId}/connectors/{name}/resume` | operator | 202 |
| POST | `/api/clusters/{clusterId}/connectors/{name}/restart` | operator | 202 |
| POST | `/api/clusters/{clusterId}/connectors/{name}/restart-failed` | operator | 202 (restart?includeTasks=true&onlyFailed=true) |
| POST | `/api/clusters/{clusterId}/connectors/{name}/tasks/{taskId}/restart` | operator | 202 |

Unknown cluster → 404 `{error}`. Connect unreachable during action → 502 `{error}`. Rebalance 409 → 409 passthrough with `{error:"rebalancing"}`.

## 4. SSE

`GET /api/clusters/{clusterId}/events` (text/event-stream). On subscribe the server sends the current
snapshot immediately, then re-sends on every poll cycle. Heartbeat comment `:hb` every ~15s.

- event: `snapshot` — data = `ClusterSnapshotDto` (JSON).
- event: `error` — data = `{message}` (e.g. cluster unreachable).

Frontend replaces its cluster state on each `snapshot` event. (Delta events are a later enhancement.)

## 5. DTO JSON shapes (exact field names; camelCase)

```ts
type Health = "RUNNING" | "DEGRADED" | "FAILED" | "PAUSED" | "UNASSIGNED" | "STOPPED" | "RESTARTING" | "UNKNOWN";
type Reachability = "REACHABLE" | "DEGRADED" | "UNREACHABLE" | "UNKNOWN";
type Role = "source" | "sink" | "unknown";

interface MeDto { username: string; roles: string[]; }  // roles like ["VIEWER","OPERATOR"]

interface ClusterSummaryDto {
  id: string; name: string; connectUrl: string;
  connectReachable: boolean; kafkaReachable: boolean; stale: boolean;
  brokerCount: number; connectorCount: number;
  failedConnectors: number; degradedConnectors: number;
  lastPollTs: number | null;   // epoch millis
}

interface ClusterHealthDto {
  clusterId: string; kafkaClusterId: string | null;
  brokersUp: number; brokersTotal: number; controllerId: number | null;
  topicCount: number; partitionCount: number;
  underReplicatedPartitions: number; offlinePartitions: number; activeControllerCount: number;
  connectVersion: string | null; connectReachable: boolean; kafkaReachable: boolean;
}

interface TaskDto { id: number; state: Health; workerId: string | null; trace: string | null; }

interface LagPartitionDto { topic: string; partition: number; currentOffset: number; endOffset: number; lag: number; }
interface LagDto { totalLag: number; byPartition: LagPartitionDto[]; }

interface ConnectorDto {
  name: string; connectorClass: string | null; type: Role;
  state: Health;            // connector-level state from Connect
  health: Health;           // rollup = worst task state (KAFKA-9066 aware)
  workerId: string | null;
  totalTasks: number; failedTasks: number;
  tasks: TaskDto[];
  topics: string[];
  externalSystemId: string | null;   // links to ExternalSystemDto.id
  lag: LagDto | null;                 // sink only
}

interface ConnectorDetailDto extends ConnectorDto {
  config: Record<string, string>;    // secrets masked as "********"
}

interface ExternalSystemDto {
  id: string; kind: string;          // "postgres" | "splunk" | "jdbc" | "elasticsearch" | "s3" | "generic" ...
  displayName: string; endpoint: string | null; role: Role;
  reachability: Reachability; lastSuccessTs: number | null;
  contributingConnectors: string[]; health: Health;   // rollup across contributing connectors
}

interface TopologyNodeDto {
  id: string; kind: "kafka" | "external";
  label: string; sublabel: string | null;
  role: "source" | "sink" | "hub"; health: Health; systemKind: string | null;
}
interface TopologyEdgeDto {
  id: string; source: string; target: string;    // node ids
  connectorName: string; health: Health;
  direction: "in" | "out";                        // in = source→kafka, out = kafka→sink
}
interface TopologyDto { nodes: TopologyNodeDto[]; edges: TopologyEdgeDto[]; }

interface ClusterSnapshotDto {
  clusterId: string; name: string; lastPollTs: number | null; stale: boolean;
  cluster: ClusterHealthDto;
  connectors: ConnectorDto[];
  externalSystems: ExternalSystemDto[];
  topology: TopologyDto;
}
```

Topology construction: one `kafka` hub node id `kafka:{clusterId}`. Each external system → one `external`
node id = its `ExternalSystemDto.id`. Each connector → one edge between the hub and its external node
(source: external→kafka `direction:"in"`; sink: kafka→external `direction:"out"`). Connectors with no
inferable external system still appear in the connectors list but may be omitted from topology (or attach
to a `generic` node).

### Consumer groups (added v0.2.0)

Kafka consumer groups appear as their own topology node kind, **distinct from connectors**. Because a
Kafka Connect SINK connector internally uses a consumer group named `connect-<connector>`, those
Connect-owned groups are **excluded** from the consumer-group set (they are already represented as
connectors) — this is the connectors-vs-consumer-groups differentiation.

```ts
interface ConsumerGroupDto {
  groupId: string;
  state: string;              // raw Kafka state: "Stable" | "Empty" | "Dead" | "PreparingRebalance" | ...
  health: Health;            // derived: Stable→RUNNING, Empty→PAUSED, Dead→FAILED, *Rebalance/Assigning/Reconciling→RESTARTING
  memberCount: number;
  coordinatorId: number | null;
  topics: string[];           // distinct topics the group has committed offsets on
  totalLag: number | null;    // sum of (logEndOffset − committedOffset) across the group; null if unknown
}
```

`ClusterSnapshotDto` gains `consumerGroups: ConsumerGroupDto[]`.

Topology node kind is now `"kafka" | "external" | "consumer"`. Consumer-group node: `id = "cg:"+groupId`,
`kind:"consumer"`, `label:groupId`, `role:"consumer"`, `systemKind:"consumer-group"`, `health` = group health.

`TopologyEdgeDto` is extended (connector edges unchanged in meaning, new fields added):
```ts
interface TopologyEdgeDto {
  id: string; source: string; target: string;
  kind: "connector" | "consumer";     // NEW — differentiates the two
  connectorName: string | null;       // set when kind="connector"
  groupId: string | null;             // NEW — set when kind="consumer"
  label: string;                      // NEW — connector name or group id (display)
  health: Health;
  direction: "in" | "out";            // consumer edges are Kafka→group, i.e. "out"
}
```
Consumer edge: `id="cgedge:"+groupId`, `kind:"consumer"`, `source=hubId`, `target="cg:"+groupId`,
`connectorName:null`, `groupId`, `label:groupId`, `direction:"out"`.

REST: `GET /api/clusters/{id}/consumer-groups` → `ConsumerGroupDto[]` (also embedded in the snapshot).
Backend config: `connectlens.consumer-groups.enabled` (default true), `connectlens.consumer-groups.max`
(default 200 — cap on groups described/lag-computed per slow poll, to bound broker load).

### Topics + directional arrows (added v0.3.0)

**Directional arrows:** every topology edge (connector AND consumer) renders an arrowhead at its
`target` end. Direction is already encoded by `source`/`target` (source connector: external→kafka;
sink: kafka→external; consumer: kafka→group), so the arrow points the correct way — no backend change.

**Per-topic producer activity:** `ClusterSnapshotDto` gains `topics: TopicDto[]`, computed on the slow
tier via AdminClient (`OffsetSpec.latest()` for end offsets + `OffsetSpec.maxTimestamp()` for the newest
record timestamp — no consuming). Internal topics (names starting with `_`) are excluded.

```ts
interface TopicDto {
  name: string;
  partitions: number;
  endOffsetSum: number;          // sum of latest offsets across partitions (~ records produced)
  lastMessageTs: number | null;  // epoch millis of the most recent record across partitions; null if empty
  state: "ACTIVE" | "IDLE" | "EMPTY";  // ACTIVE = produced within the active window; IDLE = has data, none recent; EMPTY = no data
  health: Health;                // ACTIVE→RUNNING, IDLE→DEGRADED, EMPTY→PAUSED (for the pill)
}
```

REST: `GET /api/clusters/{id}/topics` → `TopicDto[]` (also in the snapshot). Config:
`connectlens.topics.enabled` (default true), `connectlens.topics.max` (default 500),
`connectlens.topics.window` (default 300000 ms — the ACTIVE-vs-IDLE threshold on last-produced age).
UI: a "Topics" tab (grid: Topic, Partitions, Messages, Last produced [relative], State pill), default
sorted by most-recently-produced, so a healthy producer shows a recent timestamp + green ACTIVE.

## 6. External-system inference (backend)

Given a connector's `connector.class` + config map, produce an `ExternalSystemDto`:

| class pattern | kind | endpoint from | role |
|---|---|---|---|
| `io.debezium.connector.postgresql.*` | postgres | `database.hostname`:`database.port`/`database.dbname` | source |
| `io.debezium.connector.mysql.*` | mysql | `database.hostname`:`database.port` | source |
| `*JdbcSourceConnector` / `*JdbcSinkConnector` | jdbc | parse `connection.url` | source/sink |
| `io.confluent.connect.elasticsearch.*` | elasticsearch | `connection.url` | sink |
| `io.confluent.connect.s3.*` | s3 | `s3.bucket.name` | sink |
| `com.splunk.kafka.connect.SplunkSinkConnector` | splunk | `splunk.hec.uri` | sink |
| *(unmatched)* | generic | first key matching `connection|.*\.url|.*hosts?|.*uri|.*bucket` | by type |

`id` = `{kind}:{host-or-identifier}` (stable). Role from class name (Sink→sink, Source→source) or heuristic.
`type` (source/sink) also from class name suffix. Secrets: any config key containing
`password|secret|token|key|credential` is masked to `********` before leaving the backend.

## 7. Health rollup + KAFKA-9066

Connector `health` = worst of its task states, mapped: any FAILED→FAILED; else any UNASSIGNED→DEGRADED;
else if connector state PAUSED→PAUSED, STOPPED→STOPPED; else if all RUNNING→RUNNING; else UNKNOWN.
KAFKA-9066: never infer health from a missing/zero metric — health always derives from REST `/status`.
Transient: Connect 409/5xx/timeout → keep last snapshot, mark `stale:true`, do not flip connectors to FAILED.

## 8. Demo pipeline (infra)

Postgres (`inventory` db, `wal_level=logical`, table `public.customers` with a data generator doing
periodic INSERT/UPDATE) → Debezium PG source connector `pg-inventory-source` (topics `dbserver1.public.*`)
→ Kafka → Splunk sink connector `splunk-events-sink` (`splunk.hec.uri=https://splunk:8088`, HEC token).
Also seed one deliberately-broken connector (bad HEC token or bad table) to demo FAILED/degraded on the
topology. Seed is idempotent (`PUT /connectors/{name}/config`), runs after connect healthcheck passes.
