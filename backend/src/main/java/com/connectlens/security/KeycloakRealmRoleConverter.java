package com.connectlens.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

/** Maps Keycloak {@code realm_access.roles} onto Spring authorities {@code ROLE_VIEWER/OPERATOR/ADMIN}. */
public class KeycloakRealmRoleConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    @Override
    @SuppressWarnings("unchecked")
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        List<GrantedAuthority> authorities = new ArrayList<>();
        Object realmAccess = jwt.getClaim("realm_access");
        if (realmAccess instanceof Map<?, ?> map) {
            Object roles = map.get("roles");
            if (roles instanceof Collection<?> list) {
                for (Object r : list) {
                    if (r != null) {
                        authorities.add(new SimpleGrantedAuthority("ROLE_" + r.toString().toUpperCase()));
                    }
                }
            }
        }
        return authorities;
    }
}
