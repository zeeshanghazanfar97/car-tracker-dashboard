#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="${OSRM_DATA_DIR:-/data}"
PBF_PATH="${OSRM_PBF:-${DATA_DIR}/map.osm.pbf}"
PROFILE="${OSRM_PROFILE:-/opt/car.lua}"
PBF_URL="${OSM_PBF_URL:-}"

if [[ ! -f "${PBF_PATH}" ]]; then
  if [[ -n "${PBF_URL}" ]]; then
    echo "Downloading OSM PBF from ${PBF_URL} ..."
    if command -v curl >/dev/null 2>&1; then
      curl -fsSL "${PBF_URL}" -o "${PBF_PATH}"
    elif command -v wget >/dev/null 2>&1; then
      wget -qO "${PBF_PATH}" "${PBF_URL}"
    else
      echo "Neither curl nor wget is available in container."
      exit 1
    fi
  else
    echo "Missing ${PBF_PATH}. Place an .osm.pbf file there or set OSM_PBF_URL."
    exit 1
  fi
fi

BASE="${PBF_PATH%.osm.pbf}"
if [[ "${BASE}" == "${PBF_PATH}" ]]; then
  echo "OSRM_PBF must end with .osm.pbf. Current: ${PBF_PATH}"
  exit 1
fi

OSRM_BASE="${BASE}.osrm"

if [[ ! -f "${OSRM_BASE}" ]]; then
  echo "Running osrm-extract ..."
  osrm-extract -p "${PROFILE}" "${PBF_PATH}"
else
  echo "Skipping osrm-extract; ${OSRM_BASE} already exists."
fi

if [[ ! -f "${BASE}.osrm.partition" || ! -f "${BASE}.osrm.cells" ]]; then
  echo "Running osrm-partition ..."
  osrm-partition "${OSRM_BASE}"
else
  echo "Skipping osrm-partition; partition files already exist."
fi

echo "Running osrm-customize ..."
osrm-customize "${OSRM_BASE}"

echo "OSRM data ready: ${OSRM_BASE}"
