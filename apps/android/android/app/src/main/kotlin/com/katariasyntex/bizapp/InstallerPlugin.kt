package com.katariasyntex.bizapp

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.result.ActivityResult
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.MalformedURLException
import java.net.URL
import java.security.MessageDigest

/**
 * In-app APK self-update. A WebView cannot fire the Android package
 * installer, so this plugin streams the release APK into app-private cache
 * and hands it to the system installer through the FileProvider content URI
 * (no external-storage permission needed — the URI grant carries access).
 *
 * Two steps, split on purpose:
 * - downloadApk stages bytes only. It never opens settings and never
 *   launches the installer, so the JS poller can call it from the background
 *   with no user gesture. Bytes land on a .part file and are renamed only
 *   after they verify, and the URL must be the app's own release origin
 *   (BuildConfig.APP_HOST) over https — a tampered renderer cannot point the
 *   installer at an arbitrary APK.
 * - installApk hands a staged file to the system installer. It is tap-driven
 *   only: the unknown-sources settings page opens exclusively from here.
 *
 * Single-flight: a second op while one is live is rejected, so the JS store
 * never runs two downloads against one progress surface. Android may keep the
 * permission settings open for an unknown length of time, so the active call
 * stays pending until Android returns or destroys the activity.
 */
@CapacitorPlugin(name = "Installer")
class InstallerPlugin : Plugin() {

    private companion object {
        const val MIME_APK = "application/vnd.android.package-archive"
        const val BUFFER_SIZE = 64 * 1024
        const val PROGRESS_THROTTLE_MS = 200L
        const val DEFAULT_FILENAME = "ks-biz-app.apk"
    }

    private var activeOp: PluginCall? = null

    /**
     * Claims the single-flight slot; rejects a second call while the first
     * download or installer permission flow is still active.
     */
    @Synchronized
    private fun claimOp(call: PluginCall): Boolean {
        val current = activeOp
        if (current != null) {
            call.reject("already_in_progress")
            return false
        }
        activeOp = call
        return true
    }

    override fun handleOnDestroy() {
        // The plugin is going away — release the slot so the next launch can
        // stage and install again, and settle the call that was waiting.
        val pending = synchronized(this) {
            val p = activeOp
            activeOp = null
            p
        }
        pending?.reject("stalled")
        super.handleOnDestroy()
    }

    private fun stagedFile(filename: String?): File {
        val name = filename?.takeIf { it.isNotEmpty() } ?: DEFAULT_FILENAME
        return File(File(context.cacheDir, "updates"), name)
    }

    /**
     * The bare release hostname this build may install from, derived from
     * BuildConfig.APP_HOST. CI used to pass vars.APP_URL raw into -PAPP_HOST,
     * baking a scheme (https://host) into the constant while the URL being
     * compared carries only the bare host — so the strict string equality
     * below rejected every download and stale clients were locked out of the
     * API by the 426 floor with no way to update. Normalize once here: strip
     * scheme, userinfo, port and path, and lowercase. A value that cannot be
     * reduced to a bare host is a build misconfiguration and fails closed —
     * the boundary never widens from a malformed constant.
     */
    private val releaseHost: String? by lazy {
        val raw = BuildConfig.APP_HOST.trim()
        if (raw.isEmpty()) return@lazy null
        try {
            val parsed = URL(if (raw.contains("://")) raw else "https://$raw")
            parsed.host?.lowercase()?.takeIf { it.isNotEmpty() }
        } catch (_: MalformedURLException) {
            null
        }
    }

    /**
     * Only the app's own release origin may feed the system installer. The JS
     * side checks the path, but this is the boundary that counts: a renderer
     * that has been tampered with must not be able to point the installer at
     * an arbitrary APK. APP_HOST is the same FQDN the bundle bakes and CI
     * passes (app/build.gradle); debug builds keep talking to whatever origin
     * they were built against.
     */
    private fun isReleaseUrl(url: String): Boolean {
        return try {
            val parsed = URL(url)
            val protocol = parsed.protocol
            val secure = protocol.equals("https", ignoreCase = true) ||
                (BuildConfig.DEBUG && protocol.equals("http", ignoreCase = true))
            if (!secure) return false
            if (BuildConfig.DEBUG) return true
            val expected = releaseHost ?: return false
            val host = parsed.host
            host != null && host.equals(expected, ignoreCase = true)
        } catch (_: MalformedURLException) {
            false
        }
    }

    /** A caller-supplied name stays one .apk inside the staging directory. */
    private fun isSafeFilename(name: String?): Boolean {
        return name != null && name.endsWith(".apk") &&
            !name.contains("/") && !name.contains("\\") && !name.contains("..")
    }

    /**
     * Background staging: streams the release APK into app-private cache and
     * verifies its SHA-256 when the manifest carries one. Never opens
     * settings, never launches the installer. Rejects "artifact_missing" /
     * "download_failed" / "integrity_failed" / "already_in_progress".
     */
    @PluginMethod
    fun downloadApk(call: PluginCall) {
        val url = call.getString("url")
        if (url == null || !isReleaseUrl(url)) {
            call.reject("artifact_missing")
            return
        }
        val filename = call.getString("filename", DEFAULT_FILENAME)
        // The explicit null check smart-casts filename to String for the rest
        // of the method (PluginCall.getString is @Nullable) — without it,
        // stageToCache below would not compile.
        if (filename == null || !isSafeFilename(filename)) {
            call.reject("artifact_missing")
            return
        }
        if (!claimOp(call)) return
        val sha256 = call.getString("sha256", "").orEmpty()
        // Plugin.execute runs on the bridge background executor — the method
        // itself was called on the main thread, which must never block.
        execute {
            try {
                val apk = stageToCache(url, filename, sha256)
                if (apk == null) {
                    // A corrupt or substituted artifact must never reach the
                    // installer — nothing was staged, so the next attempt
                    // downloads fresh.
                    finishCall(call, "integrity_failed", null)
                } else {
                    finishCall(call, null, null)
                }
            } catch (e: Exception) {
                finishCall(call, "download_failed", e)
            }
        }
    }

    /**
     * Tap-driven install: hands the staged APK to the system package
     * installer. Rejects "not_staged" when the cache no longer holds the
     * file (evicted since staging — the caller stages again, then retries),
     * "install_permission_required" when the user must allow installs from
     * this app first, and "install_unavailable" / "already_in_progress".
     */
    @PluginMethod
    fun installApk(call: PluginCall) {
        val filename = call.getString("filename", DEFAULT_FILENAME)
        // Same boundary as downloadApk: the name must stay one .apk in the
        // staging directory, so the installer can never be pointed at an
        // arbitrary path (File.getParentFile() is ignored for absolute names).
        if (!isSafeFilename(filename)) {
            call.reject("not_staged")
            return
        }
        val apk = stagedFile(filename)
        if (!apk.isFile) {
            call.reject("not_staged")
            return
        }
        if (!claimOp(call)) return
        if (!canInstallPackages()) {
            // Android 8+ gates installs on a per-app op. The settings page is
            // the exact screen; after the user allows it, pressing Update
            // again retries from the staged file (nothing re-downloads).
            openUnknownSourcesSettings(call)
            return
        }
        launchInstaller(call, apk)
    }

    private fun canInstallPackages(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
        val pm: PackageManager = context.packageManager
        return pm.canRequestPackageInstalls()
    }

    private fun openUnknownSourcesSettings(call: PluginCall) {
        try {
            val settings = Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + context.packageName)
            )
            startActivityForResult(call, settings, "onUnknownSourcesReturn")
        } catch (_: ActivityNotFoundException) {
            finishCall(call, "install_unavailable", null)
        }
    }

    @ActivityCallback
    private fun onUnknownSourcesReturn(call: PluginCall, result: ActivityResult) {
        // The settings page never reports back a result — re-read the op and
        // either proceed or surface the allow-in-settings copy in the dialog.
        if (canInstallPackages()) {
            val apk = stagedFile(call.getString("filename", DEFAULT_FILENAME))
            if (!apk.isFile) {
                finishCall(call, "not_staged", null)
                return
            }
            launchInstaller(call, apk)
        } else {
            finishCall(call, "install_permission_required", null)
        }
    }

    /**
     * Streams the artifact into app-private cache and returns the staged file,
     * or null when the bytes failed verification.
     *
     * The download lands on a .part file and is renamed into the staged name
     * only after it verifies, so neither a dropped connection nor a corrupt
     * artifact can ever leave something at the path installApk reads. A
     * manifest without a sha256 still gets the zero-byte guard.
     */
    private fun stageToCache(url: String, filename: String, expectedSha: String): File? {
        val dir = File(context.cacheDir, "updates")
        if (!dir.exists() && !dir.mkdirs()) throw IllegalStateException("storage_unavailable")
        val target = File(dir, filename)
        val partial = File(dir, "$filename.part")
        val written = streamToFile(url, partial)
        if (written <= 0) {
            partial.delete()
            throw IllegalStateException("download_failed")
        }
        if (expectedSha.isNotEmpty() && !verifySha256(partial, expectedSha)) {
            partial.delete()
            return null
        }
        // Same-directory rename: atomic on every Android filesystem we ship to.
        if (!partial.renameTo(target)) {
            partial.delete()
            throw IllegalStateException("storage_unavailable")
        }
        return target
    }

    /** Streams url into target, reporting progress; returns the bytes written. */
    private fun streamToFile(url: String, target: File): Long {
        val conn = URL(url).openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 20_000
            conn.readTimeout = 60_000
            conn.connect()
            if (conn.responseCode < 200 || conn.responseCode >= 300) {
                throw IllegalStateException("download_failed")
            }
            val total = conn.contentLengthLong
            var written = 0L
            var lastEmit = 0L
            conn.inputStream.use { input ->
                FileOutputStream(target).use { output ->
                    val buffer = ByteArray(BUFFER_SIZE)
                    while (true) {
                        val read = input.read(buffer)
                        if (read == -1) break
                        output.write(buffer, 0, read)
                        written += read
                        val now = System.currentTimeMillis()
                        if (now - lastEmit >= PROGRESS_THROTTLE_MS) {
                            lastEmit = now
                            emitProgress(written, total)
                        }
                    }
                }
            }
            emitProgress(written, total)
            return written
        } finally {
            conn.disconnect()
        }
    }

    /** SHA-256 of a staged file, lowercase hex — compared against the manifest. */
    private fun verifySha256(apk: File, expected: String): Boolean {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(apk).use { input ->
                val buffer = ByteArray(BUFFER_SIZE)
                while (true) {
                    val read = input.read(buffer)
                    if (read == -1) break
                    digest.update(buffer, 0, read)
                }
            }
            val hex = digest.digest().joinToString("") { "%02x".format(it) }
            hex.equals(expected.trim(), ignoreCase = true)
        } catch (_: Exception) {
            false
        }
    }

    private fun emitProgress(bytes: Long, total: Long) {
        val data = JSObject()
        data.put("bytes", bytes)
        data.put("total", total)
        notifyListeners("progress", data)
    }

    private fun launchInstaller(call: PluginCall, apk: File) {
        val activity: Activity? = activity
        if (activity == null) {
            finishCall(call, "install_unavailable", null)
            return
        }
        activity.runOnUiThread {
            try {
                val contentUri = FileProvider.getUriForFile(
                    context,
                    context.packageName + ".fileprovider",
                    apk
                )
                val install = Intent(Intent.ACTION_VIEW)
                install.setDataAndType(contentUri, MIME_APK)
                install.flags = Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                context.startActivity(install)
                // The system installer owns the screen from here — resolve so
                // the JS store drops its progress readout.
                finishCall(call, null, null)
            } catch (_: ActivityNotFoundException) {
                finishCall(call, "install_unavailable", null)
            } catch (_: IllegalArgumentException) {
                finishCall(call, "install_unavailable", null)
            }
        }
    }

    private fun finishCall(call: PluginCall, code: String?, e: Exception?) {
        synchronized(this) {
            if (activeOp == call) activeOp = null
        }
        when {
            code == null -> call.resolve()
            e == null -> call.reject(code)
            else -> call.reject(code, e)
        }
    }
}
