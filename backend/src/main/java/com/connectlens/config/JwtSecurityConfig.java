package com.connectlens.config;

import com.connectlens.security.KeycloakRealmRoleConverter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfigurationSource;

/**
 * Secured mode (default): validates Keycloak-issued JWTs and enforces RBAC. Active unless
 * {@code connectlens.auth.enabled=false}.
 */
@Configuration
@ConditionalOnProperty(name = "connectlens.auth.enabled", havingValue = "true", matchIfMissing = true)
public class JwtSecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(JwtSecurityConfig.class);

    private final ConnectLensProperties props;

    public JwtSecurityConfig(ConnectLensProperties props) {
        this.props = props;
        // Loud, greppable signal of the resolved auth mode. Connector actions require the
        // OPERATOR or ADMIN realm role; a signed-in user without it gets 403 "forbidden".
        log.info("ConnectLens auth mode: ENABLED (Keycloak JWT) — RBAC enforced; "
                + "connector actions require realm role OPERATOR or ADMIN.");
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        // Validate the signature via the internal JWKS URL, but accept the browser-facing issuer.
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withJwkSetUri(props.getOidc().getJwks()).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(props.getOidc().getIssuer()));
        return decoder;
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakRealmRoleConverter());
        converter.setPrincipalClaimName("preferred_username");
        return converter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   JwtAuthenticationConverter converter,
                                                   @Qualifier("corsConfigurationSource") CorsConfigurationSource cors) throws Exception {
        http
                .cors(c -> c.configurationSource(cors))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/health", "/api/version").permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth -> oauth
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(converter)));
        return http.build();
    }
}
