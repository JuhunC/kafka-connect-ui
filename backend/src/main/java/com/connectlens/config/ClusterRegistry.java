package com.connectlens.config;

import com.connectlens.config.ConnectLensProperties.ClusterDef;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** In-memory index of configured clusters, keyed by id, preserving declaration order. */
@Component
public class ClusterRegistry {

    private final Map<String, ClusterDef> byId = new LinkedHashMap<>();

    public ClusterRegistry(ConnectLensProperties props) {
        for (ClusterDef c : props.getClusters()) {
            if (c.getId() != null) {
                byId.put(c.getId(), c);
            }
        }
    }

    public List<ClusterDef> all() {
        return List.copyOf(byId.values());
    }

    public Optional<ClusterDef> find(String id) {
        return Optional.ofNullable(byId.get(id));
    }

    public boolean exists(String id) {
        return byId.containsKey(id);
    }
}
