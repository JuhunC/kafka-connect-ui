package com.connectlens.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Root configuration bound from the {@code connectlens.*} namespace.
 * Field names are single words so environment-variable binding is unambiguous:
 *   CONNECTLENS_CLUSTERS_0_BOOTSTRAP, CONNECTLENS_OIDC_JWKS, CONNECTLENS_POLL_FAST_MS, ...
 */
@ConfigurationProperties(prefix = "connectlens")
public class ConnectLensProperties {

    private List<ClusterDef> clusters = new ArrayList<>();
    private Auth auth = new Auth();
    private Poll poll = new Poll();
    private ConsumerGroups consumerGroups = new ConsumerGroups();
    private Oidc oidc = new Oidc();
    private Cors cors = new Cors();

    public List<ClusterDef> getClusters() { return clusters; }
    public void setClusters(List<ClusterDef> clusters) { this.clusters = clusters; }

    public Auth getAuth() { return auth; }
    public void setAuth(Auth auth) { this.auth = auth; }

    public Poll getPoll() { return poll; }
    public void setPoll(Poll poll) { this.poll = poll; }

    public ConsumerGroups getConsumerGroups() { return consumerGroups; }
    public void setConsumerGroups(ConsumerGroups consumerGroups) { this.consumerGroups = consumerGroups; }

    public Oidc getOidc() { return oidc; }
    public void setOidc(Oidc oidc) { this.oidc = oidc; }

    public Cors getCors() { return cors; }
    public void setCors(Cors cors) { this.cors = cors; }

    /** A single Kafka + Kafka Connect target. */
    public static class ClusterDef {
        private String id;
        private String name;
        private String bootstrap;   // Kafka bootstrap servers, e.g. kafka:9092
        private String connect;     // Kafka Connect REST base URL, e.g. http://connect:8083

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getBootstrap() { return bootstrap; }
        public void setBootstrap(String bootstrap) { this.bootstrap = bootstrap; }
        public String getConnect() { return connect; }
        public void setConnect(String connect) { this.connect = connect; }
    }

    /** Authentication toggle. When disabled, the API is open and every request is treated
     *  as an ADMIN principal (intended for trusted/air-gapped internal networks). */
    public static class Auth {
        private boolean enabled = true;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }

    /** Consumer-group discovery (shown in the topology + Consumer Groups tab). */
    public static class ConsumerGroups {
        private boolean enabled = true;
        private int max = 200;   // cap on groups described/lag-computed per slow poll (bounds broker load)
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public int getMax() { return max; }
        public void setMax(int max) { this.max = max; }
    }

    public static class Poll {
        private boolean enabled = true;
        private long fastMs = 4000;
        private long slowMs = 30000;
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public long getFastMs() { return fastMs; }
        public void setFastMs(long fastMs) { this.fastMs = fastMs; }
        public long getSlowMs() { return slowMs; }
        public void setSlowMs(long slowMs) { this.slowMs = slowMs; }
    }

    public static class Oidc {
        private String issuer;
        private String jwks;
        public String getIssuer() { return issuer; }
        public void setIssuer(String issuer) { this.issuer = issuer; }
        public String getJwks() { return jwks; }
        public void setJwks(String jwks) { this.jwks = jwks; }
    }

    public static class Cors {
        private String allowedOrigins = "http://localhost:8080,http://localhost:5173";
        public String getAllowedOrigins() { return allowedOrigins; }
        public void setAllowedOrigins(String allowedOrigins) { this.allowedOrigins = allowedOrigins; }
    }
}
