#!/bin/sh
set -eu

ENV_FILE="/opt/supabase/docker/.env.functions"
ENDPOINT="http://127.0.0.1:8000/functions/v1/process-purchase-notifications"

# 함수 환경 파일에서 예약 작업 전용 비밀값만 읽고, 비밀값 자체는 로그에 남기지 않습니다.
CRON_SECRET=$(/usr/bin/awk -F= '$1 == "NOTIFICATION_CRON_SECRET" { print substr($0, index($0, "=") + 1); exit }' "$ENV_FILE")
if [ -z "$CRON_SECRET" ]; then
  echo "NOTIFICATION_CRON_SECRET가 설정되지 않았습니다." >&2
  exit 1
fi

/usr/bin/curl \
  --silent \
  --show-error \
  --fail \
  --retry 2 \
  --retry-delay 2 \
  --retry-connrefused \
  --connect-timeout 10 \
  --max-time 45 \
  -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -H "x-notification-cron-secret: $CRON_SECRET" \
  --data '{}'
printf '\n'
