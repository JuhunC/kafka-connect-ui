package com.connectlens.web;

import com.connectlens.config.ConnectLensProperties;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Exposes the running app/image version so the UI can always show which build is deployed. */
@RestController
@RequestMapping("/api")
public class VersionController {

    private final String version;

    public VersionController(ConnectLensProperties props) {
        String v = props.getVersion();
        // Guard against an unfiltered "@project.version@" placeholder (e.g. IDE run without resource filtering).
        if (v == null || v.isBlank() || v.startsWith("@")) {
            v = VersionController.class.getPackage().getImplementationVersion();
        }
        this.version = (v == null || v.isBlank()) ? "dev" : v;
    }

    @GetMapping("/version")
    public Map<String, String> version() {
        return Map.of("version", version);
    }
}
