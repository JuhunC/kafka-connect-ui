package com.connectlens.error;

/** The target Kafka Connect REST endpoint could not be reached or returned a server error. */
public class ConnectUnavailableException extends RuntimeException {
    public ConnectUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
    public ConnectUnavailableException(String message) {
        super(message);
    }
}
