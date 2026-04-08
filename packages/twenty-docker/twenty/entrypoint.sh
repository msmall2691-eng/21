#!/bin/sh
set -e

setup_and_migrate_db() {
    if [ "${DISABLE_DB_MIGRATIONS}" = "true" ]; then
        echo "Database setup and migrations are disabled, skipping..."
        return
    fi

    echo "Running database setup and migrations..."

    # Run setup and migration scripts
    has_schema=$(psql -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'core')" ${PG_DATABASE_URL})
    if [ "$has_schema" = "f" ]; then
        echo "Database appears to be empty, running migrations."
        yarn database:init:prod
    fi

    yarn command:prod cache:flush
    yarn command:prod upgrade
    yarn command:prod cache:flush

    echo "Successfully migrated DB!"
}

register_background_jobs() {
    if [ "${DISABLE_CRON_JOBS_REGISTRATION}" = "true" ]; then
        echo "Cron job registration is disabled, skipping..."
        return
    fi

    echo "Registering background sync jobs..."
    if yarn command:prod cron:register:all; then
        echo "Successfully registered all background sync jobs!"
    else
        echo "Warning: Failed to register background jobs, but continuing startup..."
    fi
}

setup_and_migrate_db
register_background_jobs

# Start the worker process in the background (handles email sync, calendar sync, etc.)
echo "Starting background worker..."
node dist/queue-worker/queue-worker &
WORKER_PID=$!

# Start the API server in the background
"$@" &
SERVER_PID=$!

echo "Server PID: $SERVER_PID, Worker PID: $WORKER_PID"

# Handle shutdown signals - stop both server and worker
cleanup() {
    echo "Shutting down server (PID: $SERVER_PID) and worker (PID: $WORKER_PID)..."
    kill $SERVER_PID 2>/dev/null
    kill $WORKER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    wait $WORKER_PID 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

# Wait for both processes - if either exits, shut down gracefully
wait $SERVER_PID $WORKER_PID
echo "A process exited, shutting down..."
cleanup
