package com.connectlens.error;

/** Kafka Connect returned 409 — typically a rebalance in progress. Transient. */
public class ConnectConflictException extends RuntimeException {
    public ConnectConflictException(String message) {
        super(message);
    }
}
