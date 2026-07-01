package com.connectlens.connect;

/** A task as returned by the Connect status endpoint. {@code trace} is present only on FAILED. */
public record RawTask(int id, String state, String workerId, String trace) {}
