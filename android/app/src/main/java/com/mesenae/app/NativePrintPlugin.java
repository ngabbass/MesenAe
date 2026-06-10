package com.mesenae.app;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.util.Base64;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    @PluginMethod
    public void printHtml(final PluginCall call) {
        final String html = call.getString("html");
        final String title = call.getString("title", "Document");
        final String mediaSize = call.getString("mediaSize", "default");

        if (html == null) {
            call.reject("HTML content is required");
            return;
        }

        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                // Create a temporary WebView
                final WebView webView = new WebView(getActivity());
                
                // Configure WebView settings to match app capability
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setDatabaseEnabled(true);
                webView.getSettings().setAllowFileAccess(true);
                
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                    webView.getSettings().setAllowFileAccessFromFileURLs(true);
                    webView.getSettings().setAllowUniversalAccessFromFileURLs(true);
                }
                
                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        super.onPageFinished(view, url);
                        
                        // Add 500ms delay to ensure DOM and all images/base64 resources are fully rendered
                        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    PrintManager printManager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                                    String jobName = title;
                                    
                                    PrintDocumentAdapter printAdapter;
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                                        printAdapter = webView.createPrintDocumentAdapter(jobName);
                                    } else {
                                        printAdapter = webView.createPrintDocumentAdapter();
                                    }
                                    
                                    PrintAttributes.Builder builder = new PrintAttributes.Builder();
                                    
                                    if ("A4".equalsIgnoreCase(mediaSize)) {
                                        builder.setMediaSize(PrintAttributes.MediaSize.ISO_A4);
                                    }
                                    
                                    if (printManager != null) {
                                        printManager.print(jobName, printAdapter, builder.build());
                                        JSObject ret = new JSObject();
                                        ret.put("success", true);
                                        call.resolve(ret);
                                    } else {
                                        call.reject("PrintManager not available on this device");
                                    }
                                } catch (Exception e) {
                                    call.reject("Failed to trigger print: " + e.getMessage());
                                }
                            }
                        }, 500);
                    }
                });

                // Load HTML content
                webView.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null);
            }
        });
    }

    @PluginMethod
    public void listBluetoothPrinters(PluginCall call) {
        try {
            BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
            JSObject ret = new JSObject();
            JSArray printerList = new JSArray();

            if (bluetoothAdapter == null) {
                ret.put("printers", printerList);
                call.resolve(ret);
                return;
            }

            if (!bluetoothAdapter.isEnabled()) {
                ret.put("printers", printerList);
                call.resolve(ret);
                return;
            }

            Set<BluetoothDevice> pairedDevices = bluetoothAdapter.getBondedDevices();
            if (pairedDevices != null) {
                for (BluetoothDevice device : pairedDevices) {
                    JSObject dev = new JSObject();
                    dev.put("name", device.getName());
                    dev.put("address", device.getAddress());
                    dev.put("id", device.getAddress()); // For compatibility
                    printerList.put(dev);
                }
            }
            ret.put("printers", printerList);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to list Bluetooth printers: " + e.getMessage());
        }
    }

    @PluginMethod
    public void printBluetoothEscPos(final PluginCall call) {
        final String address = call.getString("address");
        final String dataBase64 = call.getString("data");

        if (address == null || dataBase64 == null) {
            call.reject("Address and base64 data are required");
            return;
        }

        new Thread(new Runnable() {
            @Override
            public void run() {
                BluetoothSocket socket = null;
                try {
                    BluetoothAdapter bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
                    if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
                        call.reject("Bluetooth is not enabled or not supported");
                        return;
                    }

                    BluetoothDevice device = bluetoothAdapter.getRemoteDevice(address);
                    UUID uuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"); // Standard SPP UUID

                    if (bluetoothAdapter.isDiscovering()) {
                        bluetoothAdapter.cancelDiscovery();
                    }

                    socket = device.createRfcommSocketToServiceRecord(uuid);
                    socket.connect();

                    byte[] bytes = Base64.decode(dataBase64, Base64.DEFAULT);
                    socket.getOutputStream().write(bytes);
                    socket.getOutputStream().flush();

                    // Give printer time to receive data
                    try {
                        Thread.sleep(500);
                    } catch (InterruptedException ignored) {}

                    socket.close();
                    socket = null;

                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    if (socket != null) {
                        try {
                            socket.close();
                        } catch (Exception ignored) {}
                    }
                    call.reject("Failed to print via Bluetooth: " + e.getMessage());
                }
            }
        }).start();
    }
}
