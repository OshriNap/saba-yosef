#!/bin/bash
# scripts/run-server.sh
cd "$(dirname "$0")/.."
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8085 &
cd ../frontend && npm run dev &
wait
