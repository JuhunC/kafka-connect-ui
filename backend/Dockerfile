# ConnectLens backend — Spring Boot aggregator.
# Multi-stage: build the fat jar with Maven, run it on a slim JRE.
# The Java source + pom.xml are owned by the backend team; this file only builds
# whatever is present under backend/.

# ---- Stage 1: build ---------------------------------------------------------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /workspace

# Prime the dependency cache: copy the pom first so `go-offline` is only redone
# when dependencies actually change.
COPY pom.xml .
RUN mvn -q -B -e dependency:go-offline || true

COPY src ./src
RUN mvn -q -B -DskipTests package

# ---- Stage 2: run -----------------------------------------------------------
FROM eclipse-temurin:17-jre
WORKDIR /app

# curl is needed for the container healthcheck (curl -sf .../api/health).
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# Copy the single Spring Boot fat jar (excludes *.original) as app.jar.
COPY --from=build /workspace/target/*.jar /app/app.jar

EXPOSE 8090
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
