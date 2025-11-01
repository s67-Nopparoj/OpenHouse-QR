import QRCode from "qrcode";

export async function makeQrDataUrl(data: string): Promise<string> {
  try {
    return await QRCode.toDataURL(data, {
      width: 200,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("QR gen error:", err);
    return "";
  }
}
