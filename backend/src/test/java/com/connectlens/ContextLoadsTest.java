package com.connectlens;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.TestPropertySource;

/** Smoke test: the full Spring context (security, resource server, pollers, controllers) wires up. */
@SpringBootTest
@TestPropertySource(properties = {
        "connectlens.poll.enabled=false",
        "connectlens.oidc.issuer=http://localhost:8081/realms/connectlens",
        "connectlens.oidc.jwks=http://localhost:8081/realms/connectlens/protocol/openid-connect/certs"
})
class ContextLoadsTest {

    @Test
    void contextLoads() {
        // If the application context fails to start, this test fails.
    }
}
