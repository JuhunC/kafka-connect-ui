// TypeScript interfaces copied EXACTLY from CONTRACT.md section 5 (camelCase JSON).
// This file is the frontend mirror of the backend DTO shapes; keep in sync.

export type Health =
  | "RUNNING"
  | "DEGRADED"
  | "FAILED"
  | "PAUSED"
  | "UNASSIGNED"
  | "STOPPED"
  | "RESTARTING"
  | "UNKNOWN";

export type Reachability = "REACHABLE" | "DEGRADED" | "UNREACHABLE" | "UNKNOWN";

export type Role = "source" | "sink" | "unknown";

export interface MeDto {
  username: string;
  roles: string[]; // roles like ["VIEWER","OPERATOR"]
}

export interface ClusterSummaryDto {
  id: string;
  name: string;
  connectUrl: string;
  connectReachable: boolean;
  kafkaReachable: boolean;
  stale: boolean;
  brokerCount: number;
  connectorCount: number;
  failedConnectors: number;
  degradedConnectors: number;
  lastPollTs: number | null; // epoch millis
}

export interface ClusterHealthDto {
  clusterId: string;
  kafkaClusterId: string | null;
  brokersUp: number;
  brokersTotal: number;
  controllerId: number | null;
  topicCount: number;
  partitionCount: number;
  underReplicatedPartitions: number;
  offlinePartitions: number;
  activeControllerCount: number;
  connectVersion: string | null;
  connectReachable: boolean;
  kafkaReachable: boolean;
}

export interface TaskDto {
  id: number;
  state: Health;
  workerId: string | null;
  trace: string | null;
}

export interface LagPartitionDto {
  topic: string;
  partition: number;
  currentOffset: number;
  endOffset: number;
  lag: number;
}

export interface LagDto {
  totalLag: number;
  byPartition: LagPartitionDto[];
}

export interface ConnectorDto {
  name: string;
  connectorClass: string | null;
  type: Role;
  state: Health; // connector-level state from Connect
  health: Health; // rollup = worst task state (KAFKA-9066 aware)
  workerId: string | null;
  totalTasks: number;
  failedTasks: number;
  tasks: TaskDto[];
  topics: string[];
  externalSystemId: string | null; // links to ExternalSystemDto.id
  lag: LagDto | null; // sink only
}

export interface ConnectorDetailDto extends ConnectorDto {
  config: Record<string, string>; // secrets masked as "********"
}

export interface ExternalSystemDto {
  id: string;
  kind: string; // "postgres" | "splunk" | "jdbc" | "elasticsearch" | "s3" | "generic" ...
  displayName: string;
  endpoint: string | null;
  role: Role;
  reachability: Reachability;
  lastSuccessTs: number | null;
  contributingConnectors: string[];
  health: Health; // rollup across contributing connectors
}

export interface ConsumerGroupDto {
  groupId: string;
  state: string; // raw Kafka state e.g. "Stable" | "Empty" | "Dead" | "PreparingRebalance"
  health: Health; // derived group health (Stable→RUNNING, Empty→PAUSED, Dead→FAILED, *Rebalance→RESTARTING)
  memberCount: number;
  coordinatorId: number | null;
  topics: string[];
  totalLag: number | null;
}

export interface TopologyNodeDto {
  id: string;
  kind: "kafka" | "external" | "consumer";
  label: string;
  sublabel: string | null;
  role: "source" | "sink" | "hub" | "consumer";
  health: Health;
  systemKind: string | null;
}

export interface TopologyEdgeDto {
  id: string;
  source: string; // node id
  target: string; // node id
  kind: "connector" | "consumer"; // differentiates connector vs consumer-group edges
  connectorName: string | null; // set when kind="connector"
  groupId: string | null; // set when kind="consumer"
  label: string; // connector name or group id (for display)
  health: Health;
  direction: "in" | "out"; // in = source→kafka, out = kafka→sink; consumer edges are "out"
}

export interface TopologyDto {
  nodes: TopologyNodeDto[];
  edges: TopologyEdgeDto[];
}

export interface TopicDto {
  name: string;
  partitions: number;
  endOffsetSum: number;
  lastMessageTs: number | null;
  state: "ACTIVE" | "IDLE" | "EMPTY";
  health: Health;
}

export interface ClusterSnapshotDto {
  clusterId: string;
  name: string;
  lastPollTs: number | null;
  stale: boolean;
  cluster: ClusterHealthDto;
  connectors: ConnectorDto[];
  externalSystems: ExternalSystemDto[];
  consumerGroups: ConsumerGroupDto[];
  topology: TopologyDto;
  topics: TopicDto[];
}
