package com.connectlens.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
public class HttpClientConfig {

    /** Blocking HTTP client for the Kafka Connect REST API, with tight timeouts so a slow
     *  Connect worker never stalls a poll cycle. */
    @Bean
    public RestClient connectHttpClient() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(8));
        return RestClient.builder()
                .requestFactory(factory)
                .build();
    }
}
