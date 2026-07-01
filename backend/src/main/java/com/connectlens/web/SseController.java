package com.connectlens.web;

import com.connectlens.config.ClusterRegistry;
import com.connectlens.error.NotFoundException;
import com.connectlens.poller.StateStore;
import com.connectlens.sse.SseBroadcaster;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/clusters")
public class SseController {

    private final ClusterRegistry registry;
    private final StateStore store;
    private final SseBroadcaster broadcaster;

    public SseController(ClusterRegistry registry, StateStore store, SseBroadcaster broadcaster) {
        this.registry = registry;
        this.store = store;
        this.broadcaster = broadcaster;
    }

    /** Live snapshot stream for one cluster. Pushes the current snapshot on connect, then on each poll. */
    @GetMapping(value = "/{clusterId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@PathVariable String clusterId) {
        if (!registry.exists(clusterId)) {
            throw new NotFoundException("Unknown cluster: " + clusterId);
        }
        return broadcaster.subscribe(clusterId, store.getSnapshot(clusterId).orElse(null));
    }
}
