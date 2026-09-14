package com.katariasyntex.bizapp;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the page count out of a finished PDF without a full parse.
 *
 * A PDF's page tree carries /Type /Pages ... /Count N. Scanning for that token
 * is enough here: the result only feeds the print framework's page spinner —
 * a wrong count never corrupts output, it just means the framework asks the
 * user for a range. Returns 0 when nothing matches, which the caller maps to
 * PrintDocumentInfo.UNKNOWN_PAGE_COUNT.
 */
final class PdfPageCount {

    private static final Pattern PAGES_COUNT = Pattern.compile(
        "/Type\\s*/Pages[^>]*?/Count\\s+(\\d+)",
        Pattern.CASE_INSENSITIVE | Pattern.DOTALL
    );

    private PdfPageCount() {}

    /** Best-effort page count; 0 when the count token is not found. */
    static int parse(byte[] pdf) {
        if (pdf == null || pdf.length == 0) return 0;
        // The page tree sits near the end, before the xref — scan the last
        // 8 KB so a large file never becomes a whole-file String.
        int from = Math.max(0, pdf.length - 8 * 1024);
        String tail = new String(pdf, from, pdf.length - from);
        Matcher m = PAGES_COUNT.matcher(tail);
        if (m.find()) {
            try {
                return Math.max(0, Integer.parseInt(m.group(1)));
            } catch (NumberFormatException e) {
                return 0;
            }
        }
        return 0;
    }
}
