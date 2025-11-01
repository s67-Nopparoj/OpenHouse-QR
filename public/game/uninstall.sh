#!/usr/bin/env bash
set -e

APP_NAME="qr-pac"
INSTALL_DIR_DEFAULTS=("$HOME/qr_pac" "/opt/qr-pac")

echo "หยุดและลบ service ${APP_NAME}..."
sudo systemctl disable --now "${APP_NAME}.service" 2>/dev/null || true
sudo rm -f "/etc/systemd/system/${APP_NAME}.service"
sudo systemctl daemon-reload

for dir in "${INSTALL_DIR_DEFAULTS[@]}"; do
  if [ -d "$dir" ]; then
    echo "ลบโฟลเดอร์ $dir"
    sudo rm -rf "$dir"
  fi
done

echo "ลบเสร็จแล้ว ✅"
