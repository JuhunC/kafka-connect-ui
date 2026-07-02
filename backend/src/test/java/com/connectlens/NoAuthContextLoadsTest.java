package com.connectlens;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

/**
 * Smoke test for auth-disabled mode: the context must wire up WITHOUT any OIDC/JWKS config
 * (no jwtDecoder bean is created), using the open no-auth security chain.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "connectlens.poll.enabled=false",
        "connectlens.auth.enabled=false"
})
class NoAuthContextLoadsTest {

    @Test
    void contextLoads() {
        // Fails if the no-auth security chain / anonymous ADMIN wiring doesn't start.
    }
}
