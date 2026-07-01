package com.connectlens.sse;

import com.connectlens.model.ClusterSnapshotDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/** Fans out per-cluster snapshot events to subscribed browsers over SSE, with a heartbeat. */
@Component
public class SseBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(SseBroadcaster.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L;   // client reconnects after 30 min

    private final Map<String, Set<SseEmitter>> byCluster = new ConcurrentHashMap<>();

    /** Register a new subscriber for a cluster and immediately push the current snapshot (if any). */
    public SseEmitter subscribe(String clusterId, ClusterSnapshotDto initial) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Set<SseEmitter> set = byCluster.computeIfAbsent(clusterId, k -> new CopyOnWriteArraySet<>());
        set.add(emitter);
        emitter.onCompletion(() -> set.remove(emitter));
        emitter.onTimeout(() -> { set.remove(emitter); emitter.complete(); });
        emitter.onError(e -> set.remove(emitter));
        if (initial != null) {
            trySend(emitter, set, initial);
        }
        return emitter;
    }

    /** Push a fresh snapshot to every subscriber of the cluster. */
    public void broadcast(String clusterId, ClusterSnapshotDto snapshot) {
        Set<SseEmitter> set = byCluster.get(clusterId);
        if (set == null || set.isEmpty()) return;
        for (SseEmitter emitter : set) {
            trySend(emitter, set, snapshot);
        }
    }

    private void trySend(SseEmitter emitter, Set<SseEmitter> set, ClusterSnapshotDto snapshot) {
        try {
            emitter.send(SseEmitter.event().name("snapshot").data(snapshot, MediaType.APPLICATION_JSON));
        } catch (IOException | IllegalStateException e) {
            set.remove(emitter);
            try { emitter.complete(); } catch (Exception ignored) { }
        }
    }

    @Scheduled(fixedRate = 15000)
    public void heartbeat() {
        for (Set<SseEmitter> set : byCluster.values()) {
            for (SseEmitter emitter : set) {
                try {
                    emitter.send(SseEmitter.event().comment("hb"));
                } catch (Exception e) {
                    set.remove(emitter);
                    try { emitter.complete(); } catch (Exception ignored) { }
                }
            }
        }
    }
}
