import * as crypto from 'crypto';

export default function handler(req: any, res: any) {
  // ── CORS Headers ──────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { paramsToSign } = req.body;
    if (!paramsToSign) {
      return res.status(400).json({ error: "Missing paramsToSign" });
    }

    const apiSecret = process.env.VITE_CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;
    const apiKey = process.env.VITE_CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY;

    if (!apiSecret || !apiKey) {
      return res.status(500).json({ error: "Cloudinary env variables missing on server." });
    }

    // Add timestamp if not present
    const timestamp = Math.floor(Date.now() / 1000).toString();
    paramsToSign.timestamp = timestamp;

    const sortedKeys = Object.keys(paramsToSign).sort();
    const sortedParamsStr = sortedKeys.map(key => `${key}=${paramsToSign[key]}`).join('&');
    const strToSign = sortedParamsStr + apiSecret;

    const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

    return res.status(200).json({
      signature,
      timestamp,
      apiKey
    });
  } catch (error: any) {
    console.error("[Cloudinary Sign] Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
