#!/usr/bin/env bash
# Запуск бота як Sprite-сервісу. Токен береться з ~/.elastics-bot.env (BOT_TOKEN=...).
set -euo pipefail
cd "$(dirname "$0")/../.."

set -a
. "$HOME/.elastics-bot.env"
set +a

exec .venv/bin/python -u main.py
