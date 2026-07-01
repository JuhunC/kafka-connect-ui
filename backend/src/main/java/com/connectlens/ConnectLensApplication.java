package com.connectlens;

import com.connectlens.config.ConnectLensProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(ConnectLensProperties.class)
public class ConnectLensApplication {
    public static void main(String[] args) {
        SpringApplication.run(ConnectLensApplication.class, args);
    }
}
