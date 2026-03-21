/**
 * Concern tags for top PyPI packages.
 * Key: package name, Value: concern tags.
 */

export const pypiTags: ReadonlyMap<string, readonly string[]> = new Map([
  // HTTP & server
  ['django', ['http', 'server']],
  ['flask', ['http', 'server']],
  ['fastapi', ['http', 'server']],
  ['starlette', ['http', 'server']],
  ['uvicorn', ['http', 'server']],
  ['gunicorn', ['http', 'server']],
  ['requests', ['http']],
  ['httpx', ['http']],
  ['aiohttp', ['http']],
  ['urllib3', ['http']],
  ['tornado', ['http', 'server']],

  // Database & ORM
  ['sqlalchemy', ['database', 'orm']],
  ['psycopg2', ['database']],
  ['psycopg2-binary', ['database']],
  ['pymongo', ['database']],
  ['redis', ['database', 'cache']],
  ['asyncpg', ['database']],
  ['peewee', ['database', 'orm']],
  ['django-rest-framework', ['http', 'server']],
  ['alembic', ['database']],

  // Auth
  ['pyjwt', ['auth', 'crypto']],
  ['python-jose', ['auth', 'crypto']],
  ['passlib', ['auth', 'crypto']],
  ['authlib', ['auth']],

  // Logging & monitoring
  ['loguru', ['logging']],
  ['structlog', ['logging']],
  ['sentry-sdk', ['monitoring']],
  ['prometheus-client', ['monitoring']],

  // Testing
  ['pytest', ['testing']],
  ['unittest', ['testing']],
  ['mock', ['testing']],
  ['faker', ['testing']],
  ['hypothesis', ['testing']],
  ['coverage', ['testing']],
  ['tox', ['testing']],

  // Validation
  ['pydantic', ['validation']],
  ['marshmallow', ['validation']],
  ['cerberus', ['validation']],

  // Serialization
  ['protobuf', ['serialization', 'grpc']],
  ['msgpack', ['serialization']],

  // CLI
  ['click', ['cli']],
  ['typer', ['cli']],
  ['argparse', ['cli']],
  ['rich', ['cli']],

  // Build & lint & format
  ['setuptools', ['build']],
  ['wheel', ['build']],
  ['poetry', ['build']],
  ['black', ['format']],
  ['ruff', ['lint', 'format']],
  ['flake8', ['lint']],
  ['mypy', ['build']],
  ['pylint', ['lint']],
  ['isort', ['format']],

  // Config
  ['python-dotenv', ['config']],
  ['pyyaml', ['config', 'serialization']],
  ['toml', ['config', 'serialization']],

  // Date
  ['python-dateutil', ['date']],
  ['arrow', ['date']],
  ['pendulum', ['date']],

  // Utility
  ['more-itertools', ['utility']],
  ['toolz', ['utility']],

  // IO & compression
  ['pathlib', ['io']],
  ['aiofiles', ['io']],

  // Crypto
  ['cryptography', ['crypto']],
  ['hashlib', ['crypto']],

  // Image
  ['pillow', ['image']],
  ['opencv-python', ['image']],

  // Template
  ['jinja2', ['template']],
  ['mako', ['template']],

  // ML
  ['numpy', ['ml', 'math']],
  ['pandas', ['ml', 'math']],
  ['scikit-learn', ['ml']],
  ['tensorflow', ['ml']],
  ['torch', ['ml']],
  ['transformers', ['ml']],
  ['scipy', ['math']],
  ['matplotlib', ['image', 'math']],

  // Cloud
  ['boto3', ['cloud']],
  ['google-cloud-storage', ['cloud']],
  ['azure-storage-blob', ['cloud']],

  // gRPC
  ['grpcio', ['grpc']],
  ['grpcio-tools', ['grpc']],

  // Queue
  ['celery', ['queue']],
  ['rq', ['queue']],

  // Email
  ['sendgrid', ['email']],

  // WebSocket
  ['websockets', ['websocket']],
  ['channels', ['websocket']],

  // GraphQL
  ['graphene', ['graphql']],
  ['strawberry-graphql', ['graphql']],

  // Concurrency
  ['asyncio', ['concurrency']],
  ['multiprocessing', ['concurrency']],
]);
