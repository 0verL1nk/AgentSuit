#!/usr/bin/env sh

set -eu

mkdir -p /app/state /app/reports

if [ "$#" -eq 0 ]; then
  set -- serve /app/suit --host 0.0.0.0 --port 8080
fi

if [ "$1" = "serve" ]; then
  if [ ! -d /app/suit ]; then
    echo "Expected mounted Suit directory at /app/suit." >&2
    exit 1
  fi

  if [ ! -f /app/suit/suit.yaml ]; then
    echo "Expected Suit manifest at /app/suit/suit.yaml. Mount a valid Suit into /app/suit." >&2
    exit 1
  fi
fi

exec ./node_modules/.bin/suit "$@"
