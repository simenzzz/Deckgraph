/**
 * Concern tags for top Cargo (Rust) crates.
 * Key: crate name, Value: concern tags.
 */

export const cargoTags: ReadonlyMap<string, readonly string[]> = new Map([
  // HTTP & server
  ['actix-web', ['http', 'server']],
  ['axum', ['http', 'server']],
  ['hyper', ['http']],
  ['reqwest', ['http']],
  ['warp', ['http', 'server']],
  ['rocket', ['http', 'server']],
  ['tower', ['http', 'server']],
  ['tower-http', ['http', 'server']],

  // Database & ORM
  ['diesel', ['database', 'orm']],
  ['sqlx', ['database']],
  ['sea-orm', ['database', 'orm']],
  ['redis', ['database', 'cache']],
  ['rusqlite', ['database']],

  // Auth & crypto
  ['jsonwebtoken', ['auth', 'crypto']],
  ['argon2', ['auth', 'crypto']],
  ['ring', ['crypto']],
  ['rustls', ['crypto']],

  // Logging
  ['tracing', ['logging']],
  ['log', ['logging']],
  ['env_logger', ['logging']],
  ['tracing-subscriber', ['logging']],

  // Testing
  ['criterion', ['testing']],
  ['proptest', ['testing']],
  ['mockall', ['testing']],

  // Serialization
  ['serde', ['serialization']],
  ['serde_json', ['serialization']],
  ['serde_yaml', ['serialization']],
  ['bincode', ['serialization']],
  ['prost', ['serialization', 'grpc']],

  // CLI
  ['clap', ['cli']],
  ['structopt', ['cli']],

  // Validation
  ['validator', ['validation']],

  // Concurrency
  ['tokio', ['concurrency']],
  ['async-std', ['concurrency']],
  ['rayon', ['concurrency']],
  ['crossbeam', ['concurrency']],
  ['futures', ['concurrency']],

  // Config
  ['config', ['config']],
  ['dotenvy', ['config']],

  // Date
  ['chrono', ['date']],
  ['time', ['date']],

  // Utility
  ['anyhow', ['utility']],
  ['thiserror', ['utility']],
  ['once_cell', ['utility']],
  ['lazy_static', ['utility']],
  ['uuid', ['utility']],
  ['rand', ['utility', 'math']],
  ['regex', ['utility']],
  ['itertools', ['utility']],

  // IO & compression
  ['flate2', ['compression']],
  ['zip', ['compression']],

  // Image
  ['image', ['image']],

  // WebSocket
  ['tokio-tungstenite', ['websocket']],
  ['tungstenite', ['websocket']],

  // gRPC
  ['tonic', ['grpc']],

  // Queue
  ['lapin', ['queue']],

  // Cloud
  ['aws-sdk-s3', ['cloud']],

  // GraphQL
  ['async-graphql', ['graphql']],
  ['juniper', ['graphql']],

  // Build
  ['cc', ['build']],
  ['build-script', ['build']],
]);
