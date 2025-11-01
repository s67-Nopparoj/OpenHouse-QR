import paho.mqtt.client as mqtt
import time
import re
import json
from datetime import datetime
import os

# --------------------------------------------------
# ✅ CONFIG
# --------------------------------------------------
BROKER = "192.168.106.196"   # IP ของเครื่องที่รัน Mosquitto (Windows)
PORT = 1883
TOPIC = "openhouse/scan"
BOOTH_ID = 1                 # หมายเลขบูธของเครื่องนี้
RETRY_DELAY = 2              # เวลารอเมื่อเชื่อมต่อใหม่ (วินาที)
LOG_FILE = "/home/pi/Desktop/mqtt_log.txt"  # 🔹 ที่อยู่ไฟล์ log

# --------------------------------------------------
# ✅ Utility: Log helper
# --------------------------------------------------
def write_log(message: str):
    """บันทึกข้อความลงไฟล์ log"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {message}"
    print(line)  # แสดงบนหน้าจอด้วย
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception as e:
        print(f"⚠️ Cannot write log: {e}")

# --------------------------------------------------
# ✅ MQTT Setup
# --------------------------------------------------
client = mqtt.Client()
client.connected_flag = False

def on_connect(client, userdata, flags, rc):
    """เมื่อเชื่อมต่อสำเร็จ"""
    if rc == 0:
        client.connected_flag = True
        write_log(f"✅ MQTT Connected to {BROKER}:{PORT}")
        client.subscribe(TOPIC)
    else:
        write_log(f"❌ MQTT Connection failed (rc={rc})")

def on_disconnect(client, userdata, rc):
    """เมื่อหลุดการเชื่อมต่อ"""
    client.connected_flag = False
    if rc != 0:
        write_log("⚠️ MQTT Disconnected unexpectedly. Trying to reconnect...")

def connect_mqtt():
    """พยายามเชื่อมต่อ MQTT broker"""
    while not client.connected_flag:
        try:
            client.connect(BROKER, PORT, 60)
            client.loop_start()
            # รอจนเชื่อมต่อเสร็จ
            for _ in range(10):
                if client.connected_flag:
                    break
                time.sleep(0.3)
        except Exception as e:
            write_log(f"❌ MQTT connect failed: {e}")
        if not client.connected_flag:
            write_log(f"🔁 Retrying in {RETRY_DELAY}s...")
            time.sleep(RETRY_DELAY)

# ตั้ง callback
client.on_connect = on_connect
client.on_disconnect = on_disconnect

# เริ่มเชื่อมต่อ
connect_mqtt()

write_log("🎯 Ready to scan! (Ctrl + C เพื่อหยุด)")

# --------------------------------------------------
# ✅ ฟังก์ชันส่งข้อมูล MQTT
# --------------------------------------------------
def publish_qr(qr_code: str):
    """ส่ง QR code ที่อ่านได้ไปยัง Broker"""
    qr_code = qr_code.strip()
    if not qr_code:
        return

    # ✅ ดึงเฉพาะ UUID จาก URL เช่น http://192.168.1.51:5173/uuid/e2462d7c → e2462d7c
    match = re.search(r'/uuid/([A-Za-z0-9_-]+)', qr_code)
    if match:
        uuid = match.group(1)
    else:
        uuid = qr_code  # ถ้าเป็น uuid ตรงๆ อยู่แล้ว

    if len(uuid) < 4:
        write_log("⚠️ Invalid UUID, skipping.")
        return

    payload = {
        "qrCode": uuid,
        "boothId": BOOTH_ID
    }

    try:
        if not client.connected_flag:
            write_log("⚠️ Not connected to MQTT. Trying to reconnect...")
            connect_mqtt()

        msg = json.dumps(payload)
        client.publish(TOPIC, msg)
        write_log(f"📤 Sent MQTT message → {msg}")
    except Exception as e:
        write_log(f"❌ Publish failed: {e}")
        client.connected_flag = False
        connect_mqtt()

# --------------------------------------------------
# ✅ Loop รับ QR จาก keyboard / scanner
# --------------------------------------------------
try:
    last_uuid = None
    while True:
        if not client.connected_flag:
            write_log("🔄 MQTT disconnected — reconnecting...")
            connect_mqtt()

        qr_input = input("📷 Scan QR/Barcode: ").strip()
        if not qr_input:
            continue

        if qr_input == last_uuid:
            write_log("⚠️ Duplicate scan ignored.")
            continue
        last_uuid = qr_input

        publish_qr(qr_input)
        time.sleep(0.2)

except KeyboardInterrupt:
    write_log("🛑 Stopped scanning.")
    client.loop_stop()
    client.disconnect()