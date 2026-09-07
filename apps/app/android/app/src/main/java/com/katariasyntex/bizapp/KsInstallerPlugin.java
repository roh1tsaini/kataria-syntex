package com.katariasyntex.bizapp;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

/**
 * Self-update bridge: stages the published APK under cache/updates/ (written
 * by the renderer via @capacitor/filesystem) and hands it to the system
 * package installer. REQUEST_INSTALL_PACKAGES is declared in the manifest;
 * on Android 8+ the first install flips the system "install unknown apps"
 * switch for this app, once.
 */
@CapacitorPlugin(name = "KsInstaller")
public class KsInstallerPlugin extends Plugin {

    @PluginMethod
    public void installApk(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.contains("..")) {
            call.reject("invalid_path");
            return;
        }

        Context ctx = getContext();
        File apk = new File(ctx.getCacheDir(), path);
        if (!apk.isFile()) {
            call.reject("apk_not_found");
            return;
        }

        // Android 8+ requires the user to allow installs from this app; the
        // system screen returns here via onActivityResult, and the install
        // intent is re-fired once the permission is granted.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent perm = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + ctx.getPackageName()));
            perm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(perm);
            call.reject("install_permission_needed");
            return;
        }

        Uri uri = FileProvider.getUriForFile(ctx,
                ctx.getPackageName() + ".fileprovider", apk);
        Intent install = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                        | Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(install);
        call.resolve(new JSObject());
    }
}
