#!/bin/bash
# scripts/install-cron.sh
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CRON_CMD="0 8 * * 4 cd $PROJECT_DIR/backend && .venv/bin/python -m cron.weekly_prep >> $PROJECT_DIR/logs/cron.log 2>&1"
mkdir -p "$PROJECT_DIR/logs"
(crontab -l 2>/dev/null | grep -v "weekly_prep"; echo "$CRON_CMD") | crontab -
echo "Cron job installed: Thursday 08:00"
