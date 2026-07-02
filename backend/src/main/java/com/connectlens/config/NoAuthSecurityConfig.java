package com.connectlens.config;

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

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   @Qualifier("corsConfigurationSource") CorsConfigurationSource cors) throws Exception {
        http
                .cors(c -> c.configurationSource(cors))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth.anyRequest().permitAll())
                .anonymous(anon -> anon.principal("local").authorities("ROLE_ADMIN"));
        return http.build();
    }
}
