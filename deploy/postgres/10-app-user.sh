#!/bin/sh
# Runs only inside a fresh PostgreSQL container, not against an existing database.
set -eu
: "${APP_DB_USER:?}"
: "${APP_DB_PASSWORD:?}"
[ "$APP_DB_USER" != "$POSTGRES_USER" ] || { echo 'Application and database administrator roles must differ' >&2; exit 1; }
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set=ON_ERROR_STOP=1 <<'SQL'
\getenv app_user APP_DB_USER
\getenv app_password APP_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', :'app_user', :'app_password') \gexec
SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'app_user') \gexec
SQL
