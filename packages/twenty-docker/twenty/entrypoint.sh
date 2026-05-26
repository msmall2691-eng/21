#!/bin/sh
set -e

validate_env_vars() {
    local required_vars="PG_DATABASE_URL REDIS_URL APP_SECRET FRONTEND_URL"
    local missing_vars=""

    for var in $required_vars; do
        if [ -z "$(eval echo \$$var)" ]; then
            missing_vars="$missing_vars $var"
        fi
    done

    if [ -n "$missing_vars" ]; then
        echo "[ERROR] Required environment variables not set:$missing_vars"
        echo "[ERROR] Please configure them in your Railway project settings"
        exit 1
    fi

    echo "[STARTUP] Environment validation passed"
}

setup_and_migrate_db() {
    if [ "${DISABLE_DB_MIGRATIONS}" = "true" ]; then
        echo "[STARTUP] Database setup and migrations are disabled, skipping..."
        return
    fi

    echo "[STARTUP] Running database setup and migrations..."

    # Run setup and migration scripts
    has_schema=$(psql -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'core')" ${PG_DATABASE_URL})
    if [ "$has_schema" = "f" ]; then
        echo "[STARTUP] Database is empty, initializing schema and migrations..."
        yarn database:init:prod
    else
        echo "[STARTUP] Database schema found, running upgrade..."
    fi

    yarn command:prod cache:flush
    yarn command:prod upgrade
    yarn command:prod cache:flush

    echo "[STARTUP] Successfully migrated database!"
}

register_background_jobs() {
    if [ "${DISABLE_CRON_JOBS_REGISTRATION}" = "true" ]; then
        echo "[STARTUP] Cron job registration is disabled, skipping..."
        return
    fi

    echo "[STARTUP] Registering background sync jobs..."
    if yarn command:prod cron:register:all; then
        echo "[STARTUP] Successfully registered all background sync jobs!"
    else
        echo "[WARN] Failed to register background jobs, but continuing startup..."
    fi
}

validate_env_vars
setup_and_migrate_db
register_background_jobs

# Start the worker process in the background (handles email sync, calendar sync, etc.)
echo "[STARTUP] Starting background worker..."
node dist/queue-worker/queue-worker &
WORKER_PID=$!

# Start the API server in the background
echo "[STARTUP] Starting API server..."
"$@" &
SERVER_PID=$!

echo "[STARTUP] Server PID: $SERVER_PID, Worker PID: $WORKER_PID"

# Handle shutdown signals - stop both server and worker
cleanup() {
    echo "[SHUTDOWN] Terminating server (PID: $SERVER_PID) and worker (PID: $WORKER_PID)..."
    kill $SERVER_PID 2>/dev/null || true
    kill $WORKER_PID 2>/dev/null || true
    wait $SERVER_PID 2>/dev/null || true
    wait $WORKER_PID 2>/dev/null || true
    echo "[SHUTDOWN] All processes terminated"
    exit 0
}
trap cleanup SIGTERM SIGINT

# Wait for both processes - if either exits, shut down gracefully
wait $SERVER_PID $WORKER_PID || true
echo "[SHUTDOWN] A process exited, initiating graceful shutdown..."
cleanup
