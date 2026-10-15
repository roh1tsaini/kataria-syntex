import { parseQrScanCode } from "@kataria-syntex/shared";

describe("parseQrScanCode", () => {
  it("takes the code out of a login-scan URL", () => {
    expect(
      parseQrScanCode(
        "https://app.katariasyntex.workers.dev/login/scan/ABCD1234EFGH5678",
      ),
    ).toBe("ABCD1234EFGH5678");
  });

  it("decodes a percent-encoded code segment", () => {
    expect(parseQrScanCode("https://x.test/login/scan/ABCD%2D1234")).toBe(
      "ABCD-1234",
    );
  });

  it("stops at query and fragment separators", () => {
    expect(parseQrScanCode("https://x.test/login/scan/ABCD1234?ref=qr")).toBe(
      "ABCD1234",
    );
    expect(parseQrScanCode("https://x.test/login/scan/ABCD1234#top")).toBe(
      "ABCD1234",
    );
  });

  it("accepts a bare code, trimmed and upper-cased", () => {
    expect(parseQrScanCode("  pair-code ")).toBe("PAIR-CODE");
  });

  it("returns null for anything under four characters", () => {
    expect(parseQrScanCode("")).toBeNull();
    expect(parseQrScanCode("   ")).toBeNull();
    expect(parseQrScanCode("ab1")).toBeNull();
  });
});
