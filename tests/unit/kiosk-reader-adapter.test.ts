import { describe, expect, it } from "vitest";
import { extractNfcPayload, normalizeReaderPayload } from "@/features/attendance/lib/kiosk-reader-adapter";

describe("kiosk reader adapter", () => {
  it("normalizes plain reader payloads", () => {
    expect(normalizeReaderPayload(" RFID-123 ")).toBe("RFID-123");
  });

  it("strips http and https prefixes from reader payloads", () => {
    expect(normalizeReaderPayload("https://reader.local/member/ABC123")).toBe("member/ABC123");
    expect(normalizeReaderPayload("http://reader.local/ABC123")).toBe("ABC123");
  });

  it("returns an empty string for blank payloads", () => {
    expect(normalizeReaderPayload("   ")).toBe("");
  });

  it("extracts the first NFC record payload when available", () => {
    expect(
      extractNfcPayload({
        message: {
          records: [
            {
              data: {
                toString: () => "NFC-98765"
              }
            }
          ]
        }
      })
    ).toBe("NFC-98765");
  });

  it("falls back to an empty string when no NFC payload exists", () => {
    expect(extractNfcPayload({})).toBe("");
    expect(extractNfcPayload({ message: { records: [] } })).toBe("");
  });
});
