# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ── Capacitor & Cordova Core Rules ──────────────────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }

-keep class * implements com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends org.apache.cordova.CordovaPlugin { *; }
-keep class * extends com.getcapacitor.BridgeActivity { *; }

# Prevent obfuscation of JavascriptInterface methods
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ── Plugin-Specific Keep Rules ──────────────────────────────────────────────
# Keep all plugin classes to prevent reflection/obfuscation failures
-keep class com.megster.** { *; }
-keep class de.appplant.** { *; }
-keep class io.capawesome.** { *; }
-keep class com.hugotomazi.** { *; }
-keep class co.fitcom.** { *; }

# ── Firebase & Google Services ──────────────────────────────────────────────
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
-dontwarn com.google.android.gms.**
-keep class com.google.android.gms.** { *; }

# ── Kotlin & AndroidX ───────────────────────────────────────────────────────
-dontwarn androidx.**
-keep class androidx.** { *; }
-dontwarn kotlin.**
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }

# Keep Enum values()
-keepclassmembers class * extends java.lang.Enum {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# Ignore R8/ProGuard warnings to prevent compilation failure from unresolved library warnings
-ignorewarnings


