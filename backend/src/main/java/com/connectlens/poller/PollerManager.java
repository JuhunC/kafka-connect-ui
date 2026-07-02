package com.connectlens.poller;

import com.connectlens.config.ClusterRegistry;
import com.connectlens.config.ConnectLensProperties;
import com.connectlens.connect.ConnectRestClient;
import com.connectlens.kafka.KafkaAdminService;
import com.connectlens.sse.SseBroadcaster;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** Starts and owns one {@link ClusterPoller} per configured cluster. */
@Component
public class PollerManager {

    private static final Logger log = LoggerFactory.getLogger(PollerManager.class);

    private final ClusterRegistry registry;
    private final ConnectRestClient connect;
    private final KafkaAdminService admin;
    private final Normalizer normalizer;
    private final StateStore store;
    private final SseBroadcaster broadcaster;
    private final ConnectLensProperties props;

    private final List<ClusterPoller> pollers = new ArrayList<>();

    public PollerManager(ClusterRegistry registry, ConnectRestClient connect, KafkaAdminService admin,
                         Normalizer normalizer, StateStore store, SseBroadcaster broadcaster,
                         ConnectLensProperties props) {
        this.registry = registry;
        this.connect = connect;
        this.admin = admin;
        this.normalizer = normalizer;
        this.store = store;
        this.broadcaster = broadcaster;
        this.props = props;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void startAll() {
        if (!props.getPoll().isEnabled()) {
            log.info("Polling disabled (connectlens.poll.enabled=false); no cluster pollers started");
            return;
        }
        long fast = props.getPoll().getFastMs();
        long slow = props.getPoll().getSlowMs();
        boolean cgEnabled = props.getConsumerGroups().isEnabled();
        int cgMax = props.getConsumerGroups().getMax();
        boolean tEnabled = props.getTopics().isEnabled();
        int tMax = props.getTopics().getMax();
        long tWindow = props.getTopics().getWindow();
        for (ConnectLensProperties.ClusterDef c : registry.all()) {
            ClusterPoller poller = new ClusterPoller(c, connect, admin, normalizer, store, broadcaster,
                    fast, slow, cgEnabled, cgMax, tEnabled, tMax, tWindow);
            poller.start();
            pollers.add(poller);
            log.info("Started poller for cluster '{}' (connect={}, bootstrap={})",
                    c.getId(), c.getConnect(), c.getBootstrap());
        }
        if (pollers.isEmpty()) {
            log.warn("No clusters configured — set connectlens.clusters[*] / CONNECTLENS_CLUSTERS_0_*");
        }
    }

    @PreDestroy
    public void stopAll() {
        pollers.forEach(ClusterPoller::stop);
    }
}
