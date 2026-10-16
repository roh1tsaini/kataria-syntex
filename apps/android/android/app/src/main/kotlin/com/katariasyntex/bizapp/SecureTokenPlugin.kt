package com.katariasyntex.bizapp

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Session bearer token storage, encrypted at rest with a hardware-backed
 * Android Keystore key.
 *
 * The token IS the account: whoever holds it is signed in for 30 days, with no
 * password and no OTP. @capacitor/preferences wrote it into a plaintext
 * SharedPreferences XML file, which survives a device transfer, an adb dump on
 * a sideloaded debug build, and a rooted phone - and contradicted the
 * platform adapter's own docstring. The AES key here never leaves the
 * keystore (non-exportable, hardware-backed wherever the device has a TEE or
 * StrongBox), so a copied data file is ciphertext.
 *
 * Deliberately not androidx.security:security-crypto. That library is on an
 * alpha line and would add a dependency whose only job is the 60 lines below.
 * Raw KeyStore + AES/GCM is API 23+, stable forever, and has nothing to
 * upgrade or lock us into.
 *
 * One fixed slot, not a general key/value store - the session token is the
 * only secret this app holds, and a smaller surface cannot leak.
 */
@CapacitorPlugin(name = "SecureToken")
class SecureTokenPlugin : Plugin() {

    private companion object {
        const val KEY_ALIAS = "ks_biz_app_session_key"
        const val PREFS_NAME = "ks_secure_token"
        const val PREFS_KEY = "session"
        const val GCM_TAG_BITS = 128
        const val IV_BYTES = 12
    }

    private val prefs
        get() = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Fetches the existing keystore key, minting one on first use.
     *
     * Synchronised because bootstrap reads the token while a sign-in may be
     * writing it: both run on the bridge executor, both can find no entry, and
     * AndroidKeyStore throws when the alias already exists. Unsynchronised, the
     * loser would hit a catch that either drops the stored token or rejects
     * the write - a silent sign-out with nothing to show for it.
     */
    @Synchronized
    private fun sessionKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)
            ?.let { return it.secretKey }
        val generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore"
        )
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                // No per-read biometric gate: the session must be usable on
                // app launch without a prompt, and the threat being closed is
                // an at-rest file read, not a live unlocked-phone attacker.
                .setUserAuthenticationRequired(false)
                .build()
        )
        return try {
            generator.generateKey()
        } catch (e: Exception) {
            // Lost a race against another caller that minted the key first —
            // re-read it rather than failing the operation.
            val existing = keyStore.getEntry(KEY_ALIAS, null)
                as? KeyStore.SecretKeyEntry
            existing?.secretKey ?: throw e
        }
    }

    private fun encrypt(plain: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, sessionKey())
        val cipherText = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        // iv and ciphertext travel together: GCM needs both to open the value.
        return listOf(
            Base64.encodeToString(cipher.iv, Base64.NO_WRAP),
            Base64.encodeToString(cipherText, Base64.NO_WRAP)
        ).joinToString(".")
    }

    private fun decrypt(stored: String): String? = try {
        val parts = stored.split(".", limit = 2)
        val iv = Base64.decode(parts[0], Base64.NO_WRAP)
        val cipherText = Base64.decode(parts[1], Base64.NO_WRAP)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(
            Cipher.DECRYPT_MODE,
            sessionKey(),
            GCMParameterSpec(GCM_TAG_BITS, iv)
        )
        String(cipher.doFinal(cipherText), Charsets.UTF_8)
    } catch (_: Exception) {
        // Unreadable value, or a keystore key the OS invalidated (a factory
        // reset of the lock screen can invalidate StrongBox keys). Either way
        // the token is unrecoverable, so drop it - the user signs in again.
        null
    }

    /** Resolves with the stored token, or null when there is none to open. */
    @PluginMethod
    fun readToken(call: PluginCall) {
        execute {
            val stored = prefs.getString(PREFS_KEY, null)
            val token = if (stored.isNullOrEmpty()) null else decrypt(stored)
            if (!stored.isNullOrEmpty() && token == null) {
                // Could not open what was there - stop handing the renderer a
                // value it can never use.
                prefs.edit().remove(PREFS_KEY).apply()
            }
            val result = JSObject()
            result.put("token", token)
            call.resolve(result)
        }
    }

    /**
     * Stores the token encrypted. An empty or missing value clears the slot,
     * which is what a sign-out sends.
     */
    @PluginMethod
    fun writeToken(call: PluginCall) {
        val token = call.getString("token")
        execute {
            try {
                if (token.isNullOrEmpty()) {
                    prefs.edit().remove(PREFS_KEY).apply()
                } else {
                    prefs.edit().putString(PREFS_KEY, encrypt(token)).apply()
                }
                call.resolve()
            } catch (_: Exception) {
                // No keystore, no key, no disk. Never fall back to writing the
                // token in the clear — the caller signs in again instead.
                call.reject("secure_store_unavailable")
            }
        }
    }
}