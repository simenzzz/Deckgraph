/**
 * Concern tags for top Go modules.
 * Key: module path, Value: concern tags.
 */

export const goTags: ReadonlyMap<string, readonly string[]> = new Map([
  // HTTP & server
  ['github.com/gin-gonic/gin', ['http', 'server']],
  ['github.com/gorilla/mux', ['http', 'routing']],
  ['github.com/labstack/echo', ['http', 'server']],
  ['github.com/gofiber/fiber', ['http', 'server']],
  ['github.com/go-chi/chi', ['http', 'routing']],
  ['net/http', ['http']],

  // Database & ORM
  ['gorm.io/gorm', ['database', 'orm']],
  ['github.com/jmoiron/sqlx', ['database']],
  ['github.com/lib/pq', ['database']],
  ['github.com/go-sql-driver/mysql', ['database']],
  ['go.mongodb.org/mongo-driver', ['database']],
  ['github.com/go-redis/redis', ['database', 'cache']],
  ['github.com/redis/go-redis', ['database', 'cache']],
  ['github.com/mattn/go-sqlite3', ['database']],

  // Auth & crypto
  ['github.com/golang-jwt/jwt', ['auth', 'crypto']],
  ['golang.org/x/crypto', ['crypto']],

  // Logging
  ['go.uber.org/zap', ['logging']],
  ['github.com/sirupsen/logrus', ['logging']],
  ['log/slog', ['logging']],
  ['github.com/rs/zerolog', ['logging']],

  // Testing
  ['github.com/stretchr/testify', ['testing']],
  ['github.com/golang/mock', ['testing']],
  ['github.com/onsi/ginkgo', ['testing']],
  ['github.com/onsi/gomega', ['testing']],

  // Serialization
  ['encoding/json', ['serialization']],
  ['google.golang.org/protobuf', ['serialization', 'grpc']],
  ['github.com/vmihailenco/msgpack', ['serialization']],

  // CLI
  ['github.com/spf13/cobra', ['cli']],
  ['github.com/urfave/cli', ['cli']],
  ['github.com/spf13/pflag', ['cli']],

  // Validation
  ['github.com/go-playground/validator', ['validation']],

  // Config
  ['github.com/spf13/viper', ['config']],
  ['github.com/joho/godotenv', ['config']],
  ['github.com/kelseyhightower/envconfig', ['config']],

  // Concurrency
  ['golang.org/x/sync', ['concurrency']],

  // Date
  ['github.com/jinzhu/now', ['date']],

  // Utility
  ['github.com/google/uuid', ['utility']],
  ['github.com/pkg/errors', ['utility']],

  // WebSocket
  ['github.com/gorilla/websocket', ['websocket']],
  ['nhooyr.io/websocket', ['websocket']],

  // gRPC
  ['google.golang.org/grpc', ['grpc']],

  // Queue
  ['github.com/streadway/amqp', ['queue']],
  ['github.com/confluentinc/confluent-kafka-go', ['queue']],

  // Cloud
  ['github.com/aws/aws-sdk-go', ['cloud']],
  ['cloud.google.com/go', ['cloud']],

  // GraphQL
  ['github.com/99designs/gqlgen', ['graphql']],

  // Monitoring
  ['github.com/prometheus/client_golang', ['monitoring']],
  ['go.opentelemetry.io/otel', ['monitoring']],

  // IO
  ['github.com/fsnotify/fsnotify', ['io']],
]);
