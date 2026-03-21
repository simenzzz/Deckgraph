/**
 * Concern tags for top npm packages.
 * Key: package name, Value: concern tags.
 */

export const npmTags: ReadonlyMap<string, readonly string[]> = new Map([
  // HTTP & server
  ['express', ['http', 'server']],
  ['fastify', ['http', 'server']],
  ['koa', ['http', 'server']],
  ['hapi', ['http', 'server']],
  ['axios', ['http']],
  ['node-fetch', ['http']],
  ['got', ['http']],
  ['undici', ['http']],
  ['superagent', ['http']],
  ['cors', ['http', 'server']],
  ['helmet', ['http', 'server']],

  // Database & ORM
  ['pg', ['database']],
  ['mysql2', ['database']],
  ['mongodb', ['database']],
  ['redis', ['database', 'cache']],
  ['ioredis', ['database', 'cache']],
  ['sequelize', ['database', 'orm']],
  ['typeorm', ['database', 'orm']],
  ['prisma', ['database', 'orm']],
  ['@prisma/client', ['database', 'orm']],
  ['knex', ['database']],
  ['mongoose', ['database', 'orm']],
  ['better-sqlite3', ['database']],
  ['drizzle-orm', ['database', 'orm']],

  // Auth
  ['jsonwebtoken', ['auth', 'crypto']],
  ['passport', ['auth']],
  ['bcrypt', ['auth', 'crypto']],
  ['bcryptjs', ['auth', 'crypto']],
  ['jose', ['auth', 'crypto']],

  // Logging & monitoring
  ['pino', ['logging']],
  ['winston', ['logging']],
  ['bunyan', ['logging']],
  ['morgan', ['logging']],
  ['debug', ['logging']],
  ['prom-client', ['monitoring']],

  // Testing
  ['jest', ['testing']],
  ['vitest', ['testing']],
  ['mocha', ['testing']],
  ['chai', ['testing']],
  ['sinon', ['testing']],
  ['supertest', ['testing', 'http']],
  ['playwright', ['testing']],
  ['@playwright/test', ['testing']],
  ['cypress', ['testing']],
  ['@testing-library/react', ['testing']],

  // Validation
  ['zod', ['validation']],
  ['joi', ['validation']],
  ['yup', ['validation']],
  ['ajv', ['validation']],

  // Serialization
  ['protobufjs', ['serialization', 'grpc']],
  ['msgpack', ['serialization']],

  // CLI
  ['commander', ['cli']],
  ['yargs', ['cli']],
  ['inquirer', ['cli']],
  ['chalk', ['cli']],
  ['ora', ['cli']],

  // Build & lint & format
  ['webpack', ['build']],
  ['vite', ['build']],
  ['esbuild', ['build']],
  ['rollup', ['build']],
  ['turbo', ['build']],
  ['eslint', ['lint']],
  ['prettier', ['format']],
  ['typescript', ['build']],

  // UI & state
  ['react', ['ui']],
  ['react-dom', ['ui']],
  ['vue', ['ui']],
  ['svelte', ['ui']],
  ['next', ['ui', 'http', 'server']],
  ['zustand', ['state']],
  ['redux', ['state']],
  ['@reduxjs/toolkit', ['state']],
  ['mobx', ['state']],
  ['jotai', ['state']],

  // Routing
  ['react-router', ['routing']],
  ['react-router-dom', ['routing']],

  // WebSocket
  ['ws', ['websocket']],
  ['socket.io', ['websocket']],
  ['socket.io-client', ['websocket']],

  // GraphQL
  ['graphql', ['graphql']],
  ['@apollo/client', ['graphql']],
  ['@apollo/server', ['graphql', 'server']],

  // gRPC
  ['@grpc/grpc-js', ['grpc']],
  ['@grpc/proto-loader', ['grpc']],

  // Queue
  ['bullmq', ['queue']],
  ['bull', ['queue']],
  ['amqplib', ['queue']],

  // Email
  ['nodemailer', ['email']],

  // Config
  ['dotenv', ['config']],

  // Date
  ['dayjs', ['date']],
  ['date-fns', ['date']],
  ['luxon', ['date']],
  ['moment', ['date']],

  // Utility
  ['lodash', ['utility']],
  ['ramda', ['utility']],
  ['uuid', ['utility']],
  ['nanoid', ['utility']],

  // IO & compression
  ['fs-extra', ['io']],
  ['glob', ['io']],
  ['fast-glob', ['io']],
  ['archiver', ['compression']],

  // Crypto
  ['crypto-js', ['crypto']],

  // Image
  ['sharp', ['image']],
  ['jimp', ['image']],

  // Template
  ['handlebars', ['template']],
  ['ejs', ['template']],
  ['pug', ['template']],

  // Cloud
  ['aws-sdk', ['cloud']],
  ['@aws-sdk/client-s3', ['cloud']],
  ['@google-cloud/storage', ['cloud']],
  ['@azure/storage-blob', ['cloud']],
]);
