#!/usr/bin/env bash
# ============================================================================
# Runs supabase/tests/*.test.sql against a throwaway Postgres container.
#
#   npm run test:db          # apply the migrations and assert the schema
#   KEEP=1 npm run test:db   # leave the container up afterwards to poke at it
#
# Requires Docker. Not part of `npm run check` or CI — the unit suite runs
# everywhere, this one needs a container.
#
# It checks the schema twice: once on a fresh database, and once on a database
# where every migration has been applied twice, because a half-applied or
# re-applied migration is the normal state of a shared Supabase project.
# ============================================================================
set -euo pipefail

CONTAINER=quiztrick-db-test
IMAGE=postgres:16-alpine
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
fi

cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then
    echo
    echo "Container kept: docker exec -it $CONTAINER psql -U postgres quiztrick_fresh"
  else
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
echo "Starting $IMAGE ..."
# No bind mounts on purpose: SQL is piped in over stdin, which avoids Docker
# Desktop's file-sharing prompt hanging the run on macOS.
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U postgres -q 2>/dev/null && break
  sleep 0.5
done
sleep 1

psql_db() { docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -q -d "$@"; }

apply() { # apply <db> <file...>
  local db=$1; shift
  for f in "$@"; do
    psql_db "$db" < "$ROOT/$f" >/dev/null
  done
}

run_suite() { # run_suite <db> <label>
  local db=$1 label=$2
  echo
  echo "──────────────────────────────────────────────────────────────"
  echo "  $label"
  echo "──────────────────────────────────────────────────────────────"
  psql_db "$db" < "$ROOT/supabase/tests/01_schema.test.sql"
}

MIGRATIONS=(supabase/migrations/0001_initial_schema.sql supabase/migrations/0002_harden_rls_and_constraints.sql)

psql_db postgres -c "create database quiztrick_fresh" >/dev/null
apply quiztrick_fresh supabase/tests/00_supabase_stub.sql "${MIGRATIONS[@]}"
run_suite quiztrick_fresh "Fresh database"

psql_db postgres -c "create database quiztrick_rerun" >/dev/null
apply quiztrick_rerun supabase/tests/00_supabase_stub.sql "${MIGRATIONS[@]}" "${MIGRATIONS[@]}"
run_suite quiztrick_rerun "Every migration applied twice (idempotency)"

echo
echo "Database schema OK."
