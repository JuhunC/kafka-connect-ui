package com.connectlens.error;

/** A requested resource (cluster, connector) does not exist. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
