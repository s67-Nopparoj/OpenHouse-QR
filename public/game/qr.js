// qr.js — wrapper for qrcode-generator CDN global
// expects global `qrcode` provided by the CDN script
export const QRGenerator = {
  create(text, modulesHint) {
    let version = 0;
    if (typeof modulesHint === 'number') {
      const guess = Math.round((modulesHint - 17) / 4);
      if (guess >= 1 && guess <= 40) version = guess;
    }
    try {
      const qr = qrcode(version, 'M');
      qr.addData(text); qr.make();
      return qr;
    } catch {
      const qr = qrcode(0, 'M');
      qr.addData(text); qr.make();
      return qr;
    }
  }
};
