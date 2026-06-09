import { getApiUrl } from '@/lib/api-helper';

export interface MidtransItemDetail {
  id?: string;
  price: number;
  quantity: number;
  name: string;
  brand?: string;
  category?: string;
  merchant_name?: string;
}

export interface MidtransCustomerDetail {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
}

export interface MidtransTransactionDetail {
  order_id: string;
  gross_amount: number;
}

export interface MidtransTransactionConfig {
  transaction_details: MidtransTransactionDetail;
  item_details?: MidtransItemDetail[];
  customer_details?: MidtransCustomerDetail;
  enabled_payments?: string[];
  [key: string]: any; // allow extra snap fields
}

export class MidtransService {
  private static readonly isProduction = import.meta.env.VITE_MIDTRANS_IS_PRODUCTION === 'true';

  static async createTransactionToken(config: MidtransTransactionConfig): Promise<string> {
    try {
      // Use the internal nextjs API route that wraps Midtrans Snap
      const endpoint = '/api/midtrans-snap';
      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      const responseText = await response.text();
      let data: any;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Midtrans Backend returned invalid JSON:', responseText);
        throw new Error('Pembayaran gagal: respons server Midtrans tidak valid.');
      }

      if (!response.ok) {
        console.error('Midtrans Backend Error:', data);
        const errMsg = data?.error_messages?.[0] || data?.message || data?.status_message || 'Gagal memproses pembayaran dari server';
        throw new Error(errMsg);
      }

      if (!data?.token) {
        console.error('Midtrans Backend Token Missing:', data);
        throw new Error('Gagal memproses pembayaran: token Midtrans tidak diterima.');
      }

      return data.token;
    } catch (error: any) {
      console.error('Midtrans Fetch Error:', error);
      throw new Error(error.message || 'Gagal terhubung ke backend server');
    }
  }

  /**
   * Menyuntikkan script Snap Midtrans ke dalam document DOM
   */
  static async loadSnapScript(): Promise<void> {
    const clientKey = import.meta.env.VITE_MIDTRANS_CLIENT_KEY;

    if (!clientKey) {
      console.warn('Midtrans Client Key tidak ditemukan di environment variables.');
      return;
    }

    const scriptId = 'midtrans-snap-script';
    if (document.getElementById(scriptId)) return; // Script sudah dimuat

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = this.isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);

    document.head.appendChild(script);

    return new Promise((resolve, reject) => {
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Gagal memuat script Midtrans Snap'));
    });
  }

  /**
   * Memproses pembayaran via Midtrans Core API (QRIS, Bank Transfer, E-Wallet)
   * Mengembalikan data charge dari Midtrans (VA number, QR string, deeplink, dsb)
   */
  static async chargePayment(chargeConfig: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(getApiUrl('/api/midtrans-charge'), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chargeConfig),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_messages?.[0] || 'Gagal membuat transaksi Midtrans');
      }
      return data;
    } catch (error: any) {
      throw new Error(error.message || 'Gagal terhubung ke server backend');
    }
  }

  /**
   * Mengecek status transaksi Midtrans berdasarkan order_id
   */
  static async checkStatus(orderId: string): Promise<any> {
    try {
      const response = await fetch(getApiUrl(`/api/midtrans-status?orderId=${encodeURIComponent(orderId)}`), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
      return await response.json();
    } catch (error: any) {
      throw new Error(error.message || 'Gagal mengecek status pembayaran');
    }
  }
}
