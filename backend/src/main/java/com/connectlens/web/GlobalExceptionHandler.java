package com.connectlens.web;

import com.connectlens.error.ConnectConflictException;
import com.connectlens.error.ConnectUnavailableException;
import com.connectlens.error.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Map<String, String>> notFound(NotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(ConnectConflictException.class)
    public ResponseEntity<Map<String, String>> conflict(ConnectConflictException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", "rebalancing"));
    }

    @ExceptionHandler(ConnectUnavailableException.class)
    public ResponseEntity<Map<String, String>> unavailable(ConnectUnavailableException e) {
        return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> denied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "forbidden"));
    }
}
