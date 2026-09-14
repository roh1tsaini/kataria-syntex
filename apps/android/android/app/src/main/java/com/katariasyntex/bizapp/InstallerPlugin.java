package com.katariasyntex.bizapp;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app APK self-update. A WebView cannot fire the Android package
 * installer, so this plugin streams the release APK into app-private cache
 * and hands it to the system installer through the FileProvider content URI
 * (no external-storage permission needed — the URI grant carries access).
 *
 * Single-flight: a second installApk while one is in flight is rejected, so
 * the JS store never runs two downloads against one progress surface.
 */
@CapacitorPlugin(name = "Installer")
public class InstallerPlugin extends Plugin {

    private static final String MIME_APK = "application/vnd.android.package-archive";
    private static final int BUFFER_SIZE = 64 * 1024;
    private static final long PROGRESS_THROTTLE_MS = 200;

    private PluginCall activeCall = null;

    @PluginMethod
    public void installApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("artifact_missing");
            return;
        }
        synchronized (this) {
            if (activeCall != null) {
                call.reject("already_in_progress");
                return;
            }
            activeCall = call;
        }
        if (!canInstallPackages()) {
            // Android 8+ gates installs on a per-app op. The settings page is
            // the exact screen; after the user allows it, pressing Update
            // again retries the download from scratch (nothing is staged).
            openUnknownSourcesSettings(call);
            return;
        }
        startDownload(call, url);
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        PackageManager pm = getContext().getPackageManager();
        return pm.canRequestPackageInstalls();
    }

    private void openUnknownSourcesSettings(PluginCall call) {
        try {
            Intent settings = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            startActivityForResult(call, settings, "onUnknownSourcesReturn");
        } catch (ActivityNotFoundException e) {
            finishCall(call, "install_unavailable", null);
        }
    }

    @ActivityCallback
    private void onUnknownSourcesReturn(PluginCall call, ActivityResult result) {
        // The settings page never reports back a result — re-read the op and
        // either proceed or surface the allow-in-settings copy in the dialog.
        if (canInstallPackages()) {
            String url = call.getString("url");
            if (url == null || url.isEmpty()) {
                finishCall(call, "artifact_missing", null);
                return;
            }
            startDownload(call, url);
        } else {
            finishCall(call, "install_permission_required", null);
        }
    }

    private void startDownload(PluginCall call, String url) {
        String filename = call.getString("filename", "ks-biz-app.apk");
        // Plugin.execute runs on the bridge background executor — the method
        // itself was called on the main thread, which must never block.
        execute(() -> {
            try {
                downloadToCache(call, url, filename);
            } catch (Exception e) {
                finishCall(call, "download_failed", e);
            }
        });
    }

    private void downloadToCache(PluginCall call, String url, String filename)
        throws Exception {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("storage_unavailable");
        }
        File target = new File(dir, filename);
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(20_000);
        conn.setReadTimeout(60_000);
        conn.connect();
        if (conn.getResponseCode() < 200 || conn.getResponseCode() >= 300) {
            conn.disconnect();
            throw new Exception("download_failed");
        }
        long total = conn.getContentLengthLong();
        long written = 0;
        long lastEmit = 0;
        try (
            InputStream in = conn.getInputStream();
            OutputStream out = new FileOutputStream(target)
        ) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
                written += read;
                long now = System.currentTimeMillis();
                if (now - lastEmit >= PROGRESS_THROTTLE_MS) {
                    lastEmit = now;
                    emitProgress(written, total);
                }
            }
        } finally {
            conn.disconnect();
        }
        emitProgress(written, total);
        launchInstaller(call, target);
    }

    private void emitProgress(long bytes, long total) {
        JSObject data = new JSObject();
        data.put("bytes", bytes);
        data.put("total", total);
        notifyListeners("progress", data);
    }

    private void launchInstaller(PluginCall call, File apk) {
        Activity activity = getActivity();
        if (activity == null) {
            finishCall(call, "install_unavailable", null);
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                Uri contentUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    apk
                );
                Intent install = new Intent(Intent.ACTION_VIEW);
                install.setDataAndType(contentUri, MIME_APK);
                install.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK |
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
                getContext().startActivity(install);
                // The system installer owns the screen from here — resolve so
                // the JS store drops its progress readout.
                finishCall(call, null, null);
            } catch (ActivityNotFoundException e) {
                finishCall(call, "install_unavailable", e);
            } catch (IllegalArgumentException e) {
                finishCall(call, "install_unavailable", e);
            }
        });
    }

    private void finishCall(PluginCall call, String code, Exception e) {
        synchronized (this) {
            if (activeCall == call) activeCall = null;
        }
        if (code == null) {
            call.resolve();
        } else if (e == null) {
            call.reject(code);
        } else {
            call.reject(code, e);
        }
    }
}
