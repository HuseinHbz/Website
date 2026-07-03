#!/usr/bin/env bash
# install-postgresql.sh — provision PostgreSQL 17 for HBZ on Debian 12 / Ubuntu 24.04.
# Installs the server + client + contrib + pgvector, creates the cluster, database,
# role and required extensions, and enables auto-start. Idempotent.
set -euo pipefail

PG_VERSION="${PG_VERSION:-17}"
PG_DB="${PG_DB:-habibazar}"
PG_USER="${PG_USER:-habibazar}"
PG_PASSWORD="${PG_PASSWORD:-$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)}"
PG_LOCALE="${PG_LOCALE:-en_US.UTF-8}"
PG_TIMEZONE="${PG_TIMEZONE:-UTC}"

log() { printf '\033[1;34m[pg-install]\033[0m %s\n' "$*"; }

if [[ $EUID -ne 0 ]]; then echo "Run as root (sudo)."; exit 1; fi

log "Adding PostgreSQL Global Development Group (PGDG) apt repository…"
apt-get update -y
apt-get install -y curl ca-certificates gnupg lsb-release locales
install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | gpg --dearmor -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.gpg] \
http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list

log "Ensuring UTF-8 locale ($PG_LOCALE)…"
sed -i "s/^# *${PG_LOCALE}/${PG_LOCALE}/" /etc/locale.gen || true
locale-gen "$PG_LOCALE" || true

log "Installing PostgreSQL ${PG_VERSION} + client + contrib + pgvector…"
apt-get update -y
apt-get install -y \
  "postgresql-${PG_VERSION}" \
  "postgresql-client-${PG_VERSION}" \
  "postgresql-contrib-${PG_VERSION}" \
  "postgresql-${PG_VERSION}-pgvector" || \
  apt-get install -y "postgresql-${PG_VERSION}" "postgresql-client-${PG_VERSION}"

log "Enabling + starting the cluster…"
systemctl enable postgresql
pg_ctlcluster "$PG_VERSION" main start 2>/dev/null || systemctl restart postgresql
until pg_isready -q; do sleep 1; done

log "Setting cluster timezone → ${PG_TIMEZONE}…"
sudo -u postgres psql -qc "ALTER SYSTEM SET timezone = '${PG_TIMEZONE}';"
sudo -u postgres psql -qc "ALTER SYSTEM SET log_timezone = '${PG_TIMEZONE}';"

log "Creating role '${PG_USER}' and database '${PG_DB}'…"
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${PG_USER}') THEN
    CREATE ROLE ${PG_USER} LOGIN PASSWORD '${PG_PASSWORD}';
  ELSE
    ALTER ROLE ${PG_USER} WITH LOGIN PASSWORD '${PG_PASSWORD}';
  END IF;
END \$\$;
SQL
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${PG_DB}'" | grep -q 1 \
  || sudo -u postgres createdb -O "${PG_USER}" -E UTF8 -T template0 --locale="${PG_LOCALE}" "${PG_DB}"

log "Enabling extensions (pgcrypto, pg_trgm, uuid-ossp, pg_stat_statements, vector)…"
sudo -u postgres psql -d "${PG_DB}" -v ON_ERROR_STOP=1 <<SQL
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS vector;
SQL

log "Configuring pg_hba.conf (scram-sha-256 for local TCP)…"
HBA="/etc/postgresql/${PG_VERSION}/main/pg_hba.conf"
if ! grep -q "HBZ local app" "$HBA" 2>/dev/null; then
  { echo "# HBZ local app"; echo "host ${PG_DB} ${PG_USER} 127.0.0.1/32 scram-sha-256"; } >> "$HBA"
fi
sudo -u postgres psql -qc "ALTER SYSTEM SET password_encryption = 'scram-sha-256';"
systemctl restart postgresql
until pg_isready -q; do sleep 1; done

CONN="postgres://${PG_USER}:${PG_PASSWORD}@127.0.0.1:5432/${PG_DB}"
log "Done. Connection string (store in .env.local as DATABASE_URL):"
echo "  DATABASE_URL=${CONN}"
echo "${CONN}" > /root/.habibazar-pg-dsn && chmod 600 /root/.habibazar-pg-dsn
log "DSN also written to /root/.habibazar-pg-dsn (root-only)."
