// main.js — boot + touch classes + init
import { initGame } from "./game.js";

(function addTouchClasses() {
  const isCoarse = matchMedia("(hover: none) and (pointer: coarse)").matches;
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const isiPadLike =
    /iPad|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;

  if (isCoarse || hasTouch || isiPadLike)
    document.documentElement.classList.add("touch-ui");
  if (isiPadLike)
    document.documentElement.classList.add("ipad-like");
})();

window.addEventListener("DOMContentLoaded", () => {
  // ✅ ดึง uuid และ nickname จาก query string เช่น /game/index.html?uuid=abcd&name=Nay
  const params = new URLSearchParams(window.location.search);

  let uuid = params.get("uuid");
  let nickname = params.get("name");

  // ✅ fallback กรณีไม่มี query
  if (!uuid || uuid.trim() === "")
    uuid = "guest-" + Math.random().toString(36).substring(2, 8);
  if (!nickname || nickname.trim() === "") nickname = "anonymous";

  console.log("🎮 Player UUID:", uuid);
  console.log("👤 Nickname:", nickname);

  initGame({
    uuid,
    nickname,
    els: {
      sampleCard: document.getElementById("sampleCard"),
      qrCanvas: document.getElementById("qrCanvas"),
      game: document.getElementById("game"),
      scanStateEl: document.getElementById("scanState"),
      makeBtn: document.getElementById("makeBtn"),
      qrTextEl: document.getElementById("qrText"),
      qrSize: document.getElementById("qrSize"),
      joy: document.getElementById("joystick"),
      pauseBtn: document.getElementById("pauseBtn"),
      rebuildBtn: document.getElementById("rebuildBtn"),
      overlay: document.getElementById("overlay"),
      countText: document.getElementById("countText"),
      overlayMsg: document.getElementById("overlayMsg"),
      startBtn: document.getElementById("startBtn"),
      continueBtn: document.getElementById("continueBtn"),
      restartBtn: document.getElementById("restartBtn"),
      saveYesBtn: document.getElementById("saveYesBtn"),
      saveNoBtn: document.getElementById("saveNoBtn"),
      saveForm: document.getElementById("saveForm"),
      playerNameInput: document.getElementById("playerNameInput"),
      saveConfirmBtn: document.getElementById("saveConfirmBtn"),
      saveCancelBtn: document.getElementById("saveCancelBtn"),
      boardList: document.getElementById("boardList"),
      boardEmpty: document.getElementById("boardEmpty"),
      refreshBoardBtn: document.getElementById("refreshBoardBtn"),
    },
  });
});
