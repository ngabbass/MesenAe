/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly SPREADSHEET_ID: string;
  readonly FOLDER_UTAMA_ID: string;
  readonly GOOGLE_SERVICE_ACCOUNT_JSON: string;
  readonly VITE_APPS_SCRIPT_URL: string;
  readonly VITE_MIDTRANS_CLIENT_KEY: string;
  readonly VITE_MIDTRANS_MERCHANT_ID: string;
  readonly VITE_MIDTRANS_IS_PRODUCTION: string;
  readonly VITE_MIDTRANS_SERVER_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
