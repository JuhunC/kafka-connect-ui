package com.connectlens.sse;

import com.connectlens.model.ClusterSnapshotDto;
import jakarta.annotation.PreDestroy;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

/**
 * Fans out per-cluster snapshot events to subscribed browsers over SSE, with a heartbeat.
 * <p>
 * All client writes run on a dedicated bounded pool — NEVER on the caller's thread (the per-cluster
 * poll thread or the heartbeat scheduler). A slow or stalled client can therefore only tie up a
 * sender thread or have a frame dropped under overload; it can never stall polling or the heartbeat.
 * Writes to a single emitter are serialized (SseEmitter is not thread-safe) so a snapshot and a
 * heartbeat can't interleave on the same stream.
 */
@Component
public class SseBroadcaster {

    private static final long TIMEOUT_MS = 30 * 60 * 1000L;   // client reconnects after 30 min

    private final Map<String, Set<SseEmitter>> byCluster = new ConcurrentHashMap<>();

    // Dropping a stale frame under overload is fine — the next snapshot supersedes it — and is far
    // preferable to blocking the poll loop.
    private final ThreadPoolExecutor senders = new ThreadPoolExecutor(
            4, 4, 60L, TimeUnit.SECONDS,
            new LinkedBlockingQueue<>(2000),
            r -> {
                Thread t = new Thread(r, "sse-sender");
                t.setDaemon(true);
                return t;
            },
            new ThreadPoolExecutor.DiscardPolicy());

    /** Register a new subscriber for a cluster and immediately push the current snapshot (if any). */
    public SseEmitter subscribe(String clusterId, ClusterSnapshotDto initial) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        Set<SseEmitter> set = byCluster.computeIfAbsent(clusterId, k -> new CopyOnWriteArraySet<>());
        set.add(emitter);
        emitter.onCompletion(() -> set.remove(emitter));
        emitter.onTimeout(() -> { set.remove(emitter); emitter.complete(); });
        emitter.onError(e -> set.remove(emitter));
        if (initial != null) {
            submitSnapshot(emitter, set, initial);
        }
        return emitter;
    }

    /** Push a fresh snapshot to every subscriber of the cluster (asynchronously). */
    public void broadcast(String clusterId, ClusterSnapshotDto snapshot) {
        Set<SseEmitter> set = byCluster.get(clusterId);
        if (set == null || set.isEmpty()) return;
        for (SseEmitter emitter : set) {
            submitSnapshot(emitter, set, snapshot);
        }
    }

    private void submitSnapshot(SseEmitter emitter, Set<SseEmitter> set, ClusterSnapshotDto snapshot) {
        senders.execute(() -> deliver(emitter, set,
                SseEmitter.event().name("snapshot").data(snapshot, MediaType.APPLICATION_JSON)));
    }

    private void deliver(SseEmitter emitter, Set<SseEmitter> set, SseEmitter.SseEventBuilder event) {
        // Serialize per emitter: SseEmitter is not safe for concurrent sends.
        synchronized (emitter) {
            try {
                emitter.send(event);
            } catch (Exception e) {
                set.remove(emitter);
                try { emitter.complete(); } catch (Exception ignored) { }
            }
        }
    }

    @Scheduled(fixedRate = 15000)
    public void heartbeat() {
        for (Set<SseEmitter> set : byCluster.values()) {
            for (SseEmitter emitter : set) {
                senders.execute(() -> deliver(emitter, set, SseEmitter.event().comment("hb")));
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        senders.shutdownNow();
    }
}
