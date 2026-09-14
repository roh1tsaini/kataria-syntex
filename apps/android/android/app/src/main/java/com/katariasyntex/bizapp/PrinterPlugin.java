package com.katariasyntex.bizapp;

import android.app.Activity;
import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.print.PageRange;
import android.util.Base64;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

/**
 * Prints an already-rendered PDF through the Android print framework.
 *
 * The WebView's window.print() cannot reach a printer — it has no document to
 * hand the system, only the live page. This plugin takes finished PDF bytes
 * (identical to the ones the download path saves), reports their page count,
 * and streams them into the framework's destination on write. The user then
 * gets Android's own print UI: printer choice, copies, page range, or Save as
 * PDF.
 *
 * The document content comes from a real PDF file, never from the WebView, so
 * nothing here re-renders or re-typesets the challan.
 *
 * Single-flight, same rule as InstallerPlugin: a second printPdf while one is
 * in flight is rejected, so the JS caller can never run two jobs against one
 * print surface.
 */
@CapacitorPlugin(name = "Printer")
public class PrinterPlugin extends Plugin {

    private static final int BUFFER_SIZE = 64 * 1024;

    private PluginCall activeCall = null;

    @PluginMethod
    public void printPdf(PluginCall call) {
        String base64 = call.getString("base64");
        String filename = call.getString("filename", "document.pdf");
        if (base64 == null || base64.isEmpty()) {
            call.reject("pdf_missing");
            return;
        }
        synchronized (this) {
            if (activeCall != null) {
                call.reject("already_in_progress");
                return;
            }
            activeCall = call;
        }
        // Plugin.execute runs on the bridge background executor — the decode
        // and file write never touch the main thread.
        execute(() -> {
            try {
                byte[] bytes;
                try {
                    bytes = Base64.decode(base64, Base64.DEFAULT);
                } catch (IllegalArgumentException e) {
                    throw new Exception("pdf_invalid");
                }
                if (bytes.length == 0) throw new Exception("pdf_invalid");
                printBytes(call, filename, bytes);
            } catch (Exception e) {
                finishCall(call, "print_failed", e);
            }
        });
    }

    private void printBytes(PluginCall call, String filename, byte[] bytes) {
        Activity activity = getActivity();
        if (activity == null) {
            finishCall(call, "print_unavailable", null);
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                PrintManager printManager =
                    (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
                if (printManager == null) {
                    finishCall(call, "print_unavailable", null);
                    return;
                }
                String jobName = filename.endsWith(".pdf")
                    ? filename.substring(0, filename.length() - 4)
                    : filename;
                printManager.print(
                    jobName,
                    new PdfPrintAdapter(getContext(), filename, bytes),
                    new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                        .build()
                );
                // The framework owns the print UI from here — resolve so the
                // caller drops its busy state. Per-job state (queued, failed
                // or completed) is not surfaced through the bridge, by design.
                finishCall(call, null, null);
            } catch (Exception e) {
                finishCall(call, "print_unavailable", e);
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

    /**
     * Streams a finished PDF into the print framework. The document is already
     * rendered, so onLayout only reports the page count and onWrite only copies
     * bytes — no Canvas, no re-typeset. Page count is read from the PDF's own
     * /Count tree when parseable; UNKNOWN_PAGE_COUNT lets the framework ask
     * the user instead of guessing wrong.
     */
    private static final class PdfPrintAdapter extends PrintDocumentAdapter {

        private final Context context;
        private final String filename;
        private final byte[] bytes;
        private int pageCount = PrintDocumentInfo.UNKNOWN_PAGE_COUNT;

        PdfPrintAdapter(Context context, String filename, byte[] bytes) {
            this.context = context;
            this.filename = filename;
            this.bytes = bytes;
        }

        @Override
        public void onLayout(
            PrintAttributes oldAttributes,
            PrintAttributes newAttributes,
            CancellationSignal cancellationSignal,
            LayoutResultCallback callback,
            Bundle metadata
        ) {
            if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            int parsed = PdfPageCount.parse(bytes);
            if (parsed > 0) pageCount = parsed;
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(filename)
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(pageCount)
                .build();
            // true: the document changes whenever the attributes do, so the
            // framework must re-write rather than reuse a cached copy.
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(
            PageRange[] pageRanges,
            ParcelFileDescriptor destination,
            CancellationSignal cancellationSignal,
            WriteResultCallback callback
        ) {
            // The source is a finished PDF in memory; a page-range selection
            // still streams the whole document, because the framework reads
            // pages out of the file it is handed.
            try (
                InputStream in = new FileInputStream(writeTemp());
                OutputStream out = new FileOutputStream(destination.getFileDescriptor())
            ) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    if (cancellationSignal != null && cancellationSignal.isCanceled()) {
                        callback.onWriteCancelled();
                        return;
                    }
                    out.write(buffer, 0, read);
                }
                out.flush();
                callback.onWriteFinished(PageRange.ALL_PAGES);
            } catch (IOException e) {
                callback.onWriteFailed(e.toString());
            }
        }

        /** Materialises the bytes once so onWrite can stream a real file. */
        private File writeTemp() throws IOException {
            File dir = new File(context.getCacheDir(), "prints");
            if (!dir.exists() && !dir.mkdirs()) {
                throw new IOException("storage_unavailable");
            }
            File file = new File(dir, filename);
            try (OutputStream out = new FileOutputStream(file)) {
                out.write(bytes, 0, bytes.length);
                out.flush();
            }
            return file;
        }
    }
}
