#!/usr/bin/env bash

set -euo pipefail

IMAGE_TAG="agentsuit/runtime:smoke"
SUCCESS_CONTAINER="agentsuit-runtime-smoke-success"
SUCCESS_PORT="18080"
STATE_VOLUME="agentsuit-runtime-smoke-state"
REPORTS_VOLUME="agentsuit-runtime-smoke-reports"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cleanup() {
  docker rm -f "${SUCCESS_CONTAINER}" >/dev/null 2>&1 || true
  docker volume rm "${STATE_VOLUME}" "${REPORTS_VOLUME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for scripts/docker-runtime-smoke.sh." >&2
  exit 1
fi

cd "${REPO_ROOT}"

docker build -f Dockerfile.runtime -t "${IMAGE_TAG}" .

docker volume create "${STATE_VOLUME}" >/dev/null
docker volume create "${REPORTS_VOLUME}" >/dev/null

docker run -d --rm \
  --name "${SUCCESS_CONTAINER}" \
  -p "${SUCCESS_PORT}:8080" \
  -v "${REPO_ROOT}/examples/suits/minimal-starter:/app/suit:ro" \
  -v "${STATE_VOLUME}:/app/state" \
  -v "${REPORTS_VOLUME}:/app/reports" \
  "${IMAGE_TAG}" >/dev/null

for attempt in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${SUCCESS_PORT}/healthz" >/dev/null; then
    break
  fi

  sleep 0.5
done

curl -fsS "http://127.0.0.1:${SUCCESS_PORT}/healthz" >/dev/null

MISSING_OUTPUT="$(docker run --rm "${IMAGE_TAG}" 2>&1 || true)"
if [[ "${MISSING_OUTPUT}" != *"Expected Suit manifest at /app/suit/suit.yaml."* ]]; then
  echo "Missing-mount failure output did not mention the expected Suit manifest path." >&2
  echo "${MISSING_OUTPUT}" >&2
  exit 1
fi

INVALID_OUTPUT="$(
  docker run --rm \
    -v "${REPO_ROOT}/examples/suits/missing-overlay:/app/suit:ro" \
    "${IMAGE_TAG}" 2>&1 || true
)"
if [[ "${INVALID_OUTPUT}" != *"Validation failed for missing-overlay"* ]]; then
  echo "Invalid-suit failure output did not report validation failure." >&2
  echo "${INVALID_OUTPUT}" >&2
  exit 1
fi

if [[ "${INVALID_OUTPUT}" != *"[FILE_MISSING]"* ]]; then
  echo "Invalid-suit failure output did not include FILE_MISSING details." >&2
  echo "${INVALID_OUTPUT}" >&2
  exit 1
fi

echo "Docker runtime smoke checks passed."
