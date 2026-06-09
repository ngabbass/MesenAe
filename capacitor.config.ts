import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mesenae.app',
  appName: 'MesenAe',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge"],
      smallIcon: "ic_notification",
      iconColor: "#f97316"
    },
    LocalNotifications: {
      smallIcon: "ic_notification",
      iconColor: "#f97316"
    },
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 400,
      backgroundColor: "#0f172a", // Dark navy — cocok dengan dark mode app
      androidScaleType: "CENTER_CROP",
      showSpinner: false
    }
  },
  server: {
    allowNavigation: [
      "*.midtrans.com",
      "*.gopay.co.id",
      "*.shopeepay.co.id",
      "*.ovo.id",
      "*.dana.id"
    ]
  }
};

export default config;
