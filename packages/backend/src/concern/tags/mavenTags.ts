/**
 * Concern tags for top Maven (Java) artifacts.
 * Key: groupId:artifactId, Value: concern tags.
 */

export const mavenTags: ReadonlyMap<string, readonly string[]> = new Map([
  // HTTP & server
  ['org.springframework.boot:spring-boot-starter-web', ['http', 'server']],
  ['org.springframework.boot:spring-boot-starter', ['server']],
  ['io.javalin:javalin', ['http', 'server']],
  ['io.micronaut:micronaut-http-server', ['http', 'server']],
  ['io.quarkus:quarkus-resteasy', ['http', 'server']],
  ['org.apache.httpcomponents:httpclient', ['http']],
  ['com.squareup.okhttp3:okhttp', ['http']],

  // Database & ORM
  ['org.springframework.boot:spring-boot-starter-data-jpa', ['database', 'orm']],
  ['org.hibernate:hibernate-core', ['database', 'orm']],
  ['org.mybatis:mybatis', ['database']],
  ['org.postgresql:postgresql', ['database']],
  ['mysql:mysql-connector-java', ['database']],
  ['org.mongodb:mongodb-driver-sync', ['database']],
  ['redis.clients:jedis', ['database', 'cache']],
  ['io.lettuce:lettuce-core', ['database', 'cache']],
  ['com.h2database:h2', ['database']],
  ['org.flywaydb:flyway-core', ['database']],
  ['org.liquibase:liquibase-core', ['database']],

  // Auth & crypto
  ['org.springframework.boot:spring-boot-starter-security', ['auth']],
  ['io.jsonwebtoken:jjwt', ['auth', 'crypto']],
  ['org.bouncycastle:bcprov-jdk15on', ['crypto']],

  // Logging
  ['org.slf4j:slf4j-api', ['logging']],
  ['ch.qos.logback:logback-classic', ['logging']],
  ['org.apache.logging.log4j:log4j-core', ['logging']],

  // Testing
  ['junit:junit', ['testing']],
  ['org.junit.jupiter:junit-jupiter', ['testing']],
  ['org.mockito:mockito-core', ['testing']],
  ['org.assertj:assertj-core', ['testing']],
  ['org.testcontainers:testcontainers', ['testing']],
  ['org.springframework.boot:spring-boot-starter-test', ['testing']],

  // Validation
  ['jakarta.validation:jakarta.validation-api', ['validation']],
  ['org.hibernate.validator:hibernate-validator', ['validation']],

  // Serialization
  ['com.google.gson:gson', ['serialization']],
  ['com.fasterxml.jackson.core:jackson-databind', ['serialization']],
  ['com.google.protobuf:protobuf-java', ['serialization', 'grpc']],

  // CLI
  ['info.picocli:picocli', ['cli']],

  // Config
  ['org.springframework.boot:spring-boot-starter-actuator', ['monitoring', 'config']],

  // Utility
  ['org.apache.commons:commons-lang3', ['utility']],
  ['com.google.guava:guava', ['utility']],
  ['org.projectlombok:lombok', ['utility']],

  // WebSocket
  ['org.springframework.boot:spring-boot-starter-websocket', ['websocket']],

  // gRPC
  ['io.grpc:grpc-netty-shaded', ['grpc']],
  ['io.grpc:grpc-protobuf', ['grpc']],
  ['io.grpc:grpc-stub', ['grpc']],

  // Queue
  ['org.springframework.boot:spring-boot-starter-amqp', ['queue']],
  ['org.apache.kafka:kafka-clients', ['queue']],

  // Email
  ['org.springframework.boot:spring-boot-starter-mail', ['email']],

  // Cloud
  ['software.amazon.awssdk:s3', ['cloud']],
  ['com.google.cloud:google-cloud-storage', ['cloud']],

  // GraphQL
  ['com.graphql-java:graphql-java', ['graphql']],
  ['com.netflix.graphql.dgs:graphql-dgs', ['graphql']],

  // Monitoring
  ['io.micrometer:micrometer-core', ['monitoring']],
  ['io.opentelemetry:opentelemetry-api', ['monitoring']],

  // Template
  ['org.thymeleaf:thymeleaf', ['template']],
  ['org.freemarker:freemarker', ['template']],
]);
