#!/usr/bin/env bash
# Sprite засинає через ~30 с без вхідної активності, а long-polling бота її не рахує.
# Тримаємо Sprite активним через Tasks API: 5-хвилинний hold, що оновлюється щохвилини.
set -euo pipefail

api() {
  curl -s --unix-socket /.sprite/api.sock \
       -H "Content-Type: application/json" "$@"
}

trap 'api -X DELETE http://sprite/v1/tasks/elastics-bot' EXIT

while true; do
  api -X PUT http://sprite/v1/tasks/elastics-bot -d '{ "expire": "5m" }' >/dev/null
  sleep 60
done
