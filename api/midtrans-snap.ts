
interface MidtransSnapResponse {
  token?: string;
  redirect_url?: string;
  error_messages?: string[];
  status_message?: string;
}

export default async function handler(req: any, res: any) {
  // ── CORS Headers ──────────────────────────────────────────────────────────
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: `Method ${req.method} not allowed` });
  }

  const isProduction = process.env.MIDTRANS_IS_PRODUCTION === 'true' || process.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';
  const serverKey = process.env.MIDTRANS_SERVER_KEY || process.env.VITE_MIDTRANS_SERVER_KEY;

  if (!serverKey) {
    console.error('[Midtrans Snap] Server Key is missing.');
    return res.status(500).json({
      error_messages: ['Server misconfiguration: Midtrans Server Key tidak ditemukan.'],
    });
  }

  const authString = Buffer.from(`${serverKey}:`).toString('base64');
  const targetUrl = isProduction 
    ? 'https://app.midtrans.com/snap/v1/transactions' 
    : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`,
      },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
    });

    const data = (await response.json()) as MidtransSnapResponse;

    if (!response.ok) {
      const errMsg = data.error_messages?.[0] || data.status_message || `Gagal mendapatkan token Midtrans (${response.status})`;
      console.error('[Midtrans Snap] API Error:', data);
      return res.status(response.status).json({ error_messages: [errMsg], raw: data });
    }

    // Berhasil mendapatkan token
    return res.status(200).json({ 
      token: data.token,
      redirect_url: data.redirect_url 
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Midtrans Snap] Network Error:', errMsg);
    return res.status(500).json({
      error_messages: [`Gagal terhubung ke server Snap Midtrans: ${errMsg}`],
    });
  }
}
