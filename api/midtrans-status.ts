
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
    return res.status(405).json({ error_messages: [`Method ${req.method} not allowed`] });
  }

  const { orderId } = req.query;
  const targetOrderId = Array.isArray(orderId) ? orderId[0] : orderId;

  if (!targetOrderId) {
    return res.status(400).json({ error_messages: ['Parameter "orderId" wajib disertakan.'] });
  }

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true' || process.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
  const serverKey = process.env.MIDTRANS_SERVER_KEY || process.env.VITE_MIDTRANS_SERVER_KEY;

  if (!serverKey) {
    console.error('[Midtrans Status] Server Key is missing.');
    return res.status(500).json({ 
      error_messages: ['Server misconfiguration: Midtrans Server Key tidak ditemukan.'] 
    });
  }

  const authString = Buffer.from(`${serverKey}:`).toString('base64');
  const baseUrl = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  // Sanitasi orderId agar tidak memecah URL (URL Encoding)
  const encodedOrderId = encodeURIComponent(targetOrderId);

  try {
    const response = await fetch(`${baseUrl}/v2/${encodedOrderId}/status`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
    });

    const data = await response.json();

    // Jika order tidak ditemukan di Midtrans (biasanya status 404)
    if (!response.ok) {
      console.warn(`[Midtrans Status] Info: Order ${targetOrderId} -> HTTP ${response.status}`);
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Midtrans Status] Error for Order ${targetOrderId}:`, errMsg);
    return res.status(500).json({ 
      error_messages: [`Gagal memeriksa status pembayaran: ${errMsg}`] 
    });
  }
}
