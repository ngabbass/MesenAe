package com.mesenae.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                int keyResId = getResources().getIdentifier("google_api_key", "string", getPackageName());
                int appIdResId = getResources().getIdentifier("google_app_id", "string", getPackageName());
                int projectIdResId = getResources().getIdentifier("project_id", "string", getPackageName());
                int gcmSenderResId = getResources().getIdentifier("gcm_defaultSenderId", "string", getPackageName());

                if (keyResId != 0 && appIdResId != 0) {
                    FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApiKey(getString(keyResId))
                        .setApplicationId(getString(appIdResId))
                        .setProjectId(projectIdResId != 0 ? getString(projectIdResId) : "mesenae")
                        .setGcmSenderId(gcmSenderResId != 0 ? getString(gcmSenderResId) : "476484576003")
                        .build();
                    FirebaseApp.initializeApp(this, options);
                    android.util.Log.i("MainActivity", "FirebaseApp initialized programmatically with resource credentials successfully before super.onCreate");
                } else {
                    android.util.Log.w("MainActivity", "Firebase resources not found, skipping programmatic initialization");
                }
            }
        } catch (Exception e) {
            android.util.Log.e("MainActivity", "Failed to initialize FirebaseApp safely", e);
        }

        // Create high-priority notification channel for order notifications (Android 8.0+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                "mesenae_orders",
                "Notifikasi Pesanan",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Notifikasi push saat ada pesanan masuk");
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 110, 500});
            channel.enableLights(true);
            channel.setShowBadge(true);

            // Set notification sound to ding.mp3 from res/raw if it exists
            try {
                Uri soundUri = Uri.parse("android.resource://" + getPackageName() + "/raw/ding");
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
                channel.setSound(soundUri, audioAttributes);
            } catch (Exception e) {
                // fallback: use default sound
            }

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }

        super.onCreate(savedInstanceState);

        // Request Bluetooth permissions dynamically for Android 12+ (Nearby Devices permission)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{
                    Manifest.permission.BLUETOOTH_CONNECT,
                    Manifest.permission.BLUETOOTH_SCAN
                }, 1012);
            }
        }
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applySystemUiVisibility(newConfig.orientation);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applySystemUiVisibility(getResources().getConfiguration().orientation);
        }
    }

    private void applySystemUiVisibility(int orientation) {
        if (orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE) {
            // Hide Status Bar & Navigation Bar for Immersive Fullscreen in Landscape
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.view.WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.hide(android.view.WindowInsets.Type.statusBars() | android.view.WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                }
            } else {
                getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                );
            }
        } else {
            // Show Status Bar & Navigation Bar normally in Portrait
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                android.view.WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.show(android.view.WindowInsets.Type.statusBars() | android.view.WindowInsets.Type.navigationBars());
                }
            } else {
                getWindow().getDecorView().setSystemUiVisibility(
                    android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
            }
        }
    }
}
