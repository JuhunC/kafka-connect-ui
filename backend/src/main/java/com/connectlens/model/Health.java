package com.connectlens.model;

/** Connector/task health. Serialized by name(), matching the frontend Health union. */
public enum Health {
    RUNNING, DEGRADED, FAILED, PAUSED, UNASSIGNED, STOPPED, RESTARTING, UNKNOWN
}
