
export default async function handler(req: any, res: any) {
  // ── CORS Headers ──────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { url } = req.query;
  const targetUrl = Array.isArray(url) ? url[0] : url; // Pastikan berupa string tunggal

  const serverKey = process.env.MIDTRANS_SERVER_KEY || process.env.VITE_MIDTRANS_SERVER_KEY;

  if (!serverKey) {
    return res.status(500).json({ error: 'Server misconfiguration: Midtrans Server Key not configured.' });
  }
  
  if (!targetUrl) {
    return res.status(400).json({ error: 'Parameter "url" wajib disertakan.' });
  }

  const decodedUrl = decodeURIComponent(targetUrl);

  // SECURITY: SSRF Protection. Pastikan URL benar-benar berasal dari infrastruktur Midtrans API.
  const isSafeUrl = /^https:\/\/(api|api\.sandbox)\.midtrans\.com\/.+/i.test(decodedUrl);
  if (!isSafeUrl) {
    console.warn(`[Midtrans QR Proxy] SSRF Attempt blocked for URL: ${decodedUrl}`);
    return res.status(403).json({ error: 'Invalid or forbidden URL domain.' });
  }

  try {
    const authString = Buffer.from(`${serverKey}:`).toString('base64');
    
    const response = await fetch(decodedUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'image/png, image/jpeg, image/*, application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => 'No error text available');
      console.error(`[Midtrans QR Proxy] Failed fetching QR: HTTP ${response.status} - ${text}`);
      return res.status(response.status).json({ error: 'Gagal mengambil gambar QR dari Gateway.' });
    }

    // Ambil data gambar dalam bentuk ArrayBuffer lalu ubah ke Buffer NodeJS
    const contentType = response.headers.get('content-type') || 'image/png';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set Header yang tepat agar browser merendernya sebagai gambar, dan cegah caching berlebih
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).send(buffer);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Midtrans QR Proxy] Internal Error:', errMsg);
    return res.status(500).json({ error: `Internal Server Error: ${errMsg}` });
  }
}
