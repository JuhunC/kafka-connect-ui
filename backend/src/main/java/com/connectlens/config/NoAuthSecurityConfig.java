package com.connectlens.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * No-auth mode ({@code connectlens.auth.enabled=false}): the API is fully open and every request
 * runs as an anonymous principal named "local" holding ROLE_ADMIN, so RBAC checks pass and the UI
 * shows all actions. Intended for trusted / air-gapped internal networks with no OIDC provider.
 */
@Configuration
@ConditionalOnProperty(name = "connectlens.auth.enabled", havingValue = "false")
public class NoAuthSecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(NoAuthSecurityConfig.class);

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   @Qualifier("corsConfigurationSource") CorsConfigurationSource cors) throws Exception {
        // Loud, greppable signal of the resolved auth mode. If you expected auth to be OFF and
        // don't see this line, the backend never received connectlens.auth.enabled=false.
        log.warn("ConnectLens auth mode: DISABLED (no-auth) — the API is OPEN; every request runs "
                + "as 'local' with ROLE_ADMIN, so all connector actions (pause/resume/restart) are allowed.");
        http
                .cors(c -> c.configurationSource(cors))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .anonymous(anon -> anon.principal("local").authorities("ROLE_ADMIN"));
        return http.build();
    }
}
