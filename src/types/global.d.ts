/**
 * Global Type Definitions
 * Mendeklarasikan tipe untuk library eksternal yang di-inject secara global
 */

interface Window {
  /**
   * Midtrans Snap - Payment gateway integration
   * Docs: https://docs.midtrans.com/en/snap/integration-guide
   */
  snap?: {
    pay: (
      token: string,
      options: {
        onSuccess?: (result: any) => void;
        onPending?: (result: any) => void;
        onError?: (result: any) => void;
        onClose?: () => void;
      }
    ) => void;
  };

  /**
   * Midtrans Snap Active Flag
   * Digunakan untuk mencegah multiple snap instances
   */
  midtransSnapActive?: boolean;

  /**
   * Cordova Bluetooth Serial Plugin
   * Docs: https://github.com/don/cordova-plugin-bluetooth-serial
   */
  bluetoothSerial?: {
    connect: (
      address: string,
      onSuccess: () => void,
      onError: (error: any) => void
    ) => void;
    disconnect: (
      onSuccess?: () => void,
      onError?: (error: any) => void
    ) => void;
    write: (
      data: ArrayBuffer,
      onSuccess: () => void,
      onError: (error: any) => void
    ) => void;
    list: (
      onSuccess: (devices: Array<{ name: string; address: string; class?: number; id?: string }>) => void,
      onError: (error: any) => void
    ) => void;
    isEnabled: (
      onSuccess: () => void,
      onError: () => void
    ) => void;
    isConnected: (
      onSuccess: () => void,
      onError: () => void
    ) => void;
  };

  /**
   * Cordova Plugin
   * Base cordova object
   */
  cordova?: {
    plugins?: {
      printer?: any;
    };
  };
}

/**
 * Capacitor Global Types
 */
declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      getPlatform: () => string;
    };
  }
}

export {};
