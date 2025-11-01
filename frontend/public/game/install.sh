#!/usr/bin/env bash
set -euo pipefail

# ========== AUTO-DETECT ==========
# เลือก user เป้าหมายแบบฉลาด: $TARGET_USER (ถ้ากำหนดมา) > SUDO_USER > logname > id -un
TARGET_USER="${TARGET_USER:-${SUDO_USER:-$(logname 2>/dev/null || id -un)}}"
# home dir ของ user นั้น
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6 || true)"
[ -n "${TARGET_HOME:-}" ] || TARGET_HOME="/home/$TARGET_USER"

# ========== CONFIG (เปลี่ยนชื่อแอปได้) ==========
APP_NAME="qr-pac"
APP_USER="$TARGET_USER"                   # จะรัน service ในนาม user นี้
INSTALL_DIR="${INSTALL_DIR:-${TARGET_HOME}/qr_pac}"  # ดีฟอลต์ติดตั้งในโฮม
SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
NODE_MIN_MAJOR=18
PORT_DEFAULT="${PORT_DEFAULT:-8000}"
# ===============================================

echob() { printf "\n\033[1m%s\033[0m\n" "$*"; }
die()   { echo "ERROR: $*" >&2; exit 1; }

require_root() {
  [ "$(id -u)" -eq 0 ] || die "ต้องรันด้วย sudo หรือ root"
}

validate_user() {
  getent passwd "$APP_USER" >/dev/null || die "ไม่พบ user '$APP_USER' ในระบบ"
}

check_node() {
  if command -v node >/dev/null 2>&1; then
    local major; major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
    if [ "$major" -lt "$NODE_MIN_MAJOR" ]; then
      echob "Node เวอร์ชันเก่า ติดตั้งใหม่..."
      install_node
    fi
  else
    echob "ไม่พบ Node ติดตั้งให้..."
    install_node
  fi
}

install_node() {
  apt-get update -y
  apt-get install -y nodejs npm
  command -v node >/dev/null || die "ติดตั้ง nodejs ไม่สำเร็จ"
}

copy_app() {
  echob "คัดลอกไฟล์แอปไป ${INSTALL_DIR}"
  mkdir -p "${INSTALL_DIR}"
  rsync -a --delete "app/" "${INSTALL_DIR}/"
  chown -R "${APP_USER}:${APP_USER}" "${INSTALL_DIR}"
}

npm_install() {
  echob "ติดตั้ง dependencies (npm install --production) ในฐานะ ${APP_USER}"
  pushd "${INSTALL_DIR}" >/dev/null
  # รัน npm ด้วย user เป้าหมาย เพื่อไม่ให้ node_modules เป็นของ root
  runuser -u "${APP_USER}" -- npm install --production
  popd >/dev/null
}

migrate_json_if_any() {
  if [ -f "${INSTALL_DIR}/scoreboard.json" ]; then
    echob "พบ scoreboard.json → migrate เข้า SQLite"
    runuser -u "${APP_USER}" -- node "${INSTALL_DIR}/migrate_json_to_sqlite.js" || true
    mv "${INSTALL_DIR}/scoreboard.json" "${INSTALL_DIR}/scoreboard.json.bak.$(date +%s)" || true
  fi
}

make_service() {
  echob "สร้าง systemd service: ${SERVICE_FILE}"
  cat >"${SERVICE_FILE}" <<EOF
[Unit]
Description=QR Scoreboard Server
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/env node ${INSTALL_DIR}/server.js
User=${APP_USER}
Restart=always
Environment=NODE_ENV=production PORT=${PORT_DEFAULT}

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now "${APP_NAME}.service"
}

show_info() {
  echob "ติดตั้งเสร็จแล้ว"
  ipaddrs="$(hostname -I | awk '{print $1}')"
  echo "สถานะเซอร์วิส:  systemctl status ${APP_NAME}"
  echo "ไลฟ์ล็อก:       journalctl -u ${APP_NAME} -f"
  echo "เข้าผ่าน LAN:   http://${ipaddrs:-<IP>}:${PORT_DEFAULT}"
  echo "ติดตั้งที่:      ${INSTALL_DIR}  (owner: ${APP_USER})"
}

require_root
[ -d app ] || die "หาโฟลเดอร์ ./app ไม่เจอ (ต้องรันจากโฟลเดอร์แพ็กเกจที่มีโฟลเดอร์ app/)"
validate_user
check_node
copy_app
npm_install
migrate_json_if_any
make_service
show_info
