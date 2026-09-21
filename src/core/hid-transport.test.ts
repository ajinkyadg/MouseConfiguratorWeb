import { describe, it, expect } from "vitest";
import { identifyM913, M913_VENDOR_IDS, M913_PRODUCT_IDS } from "./hid-transport";

const areson = { vendorId: M913_VENDOR_IDS.areson, productId: M913_PRODUCT_IDS.aresonWired };
const compx = { vendorId: M913_VENDOR_IDS.compx, productId: M913_PRODUCT_IDS.compxWired };

describe("identifyM913", () => {
  it.each(["Redragon M913 Impact Elite", "M913", "M-913 Gaming Mouse", "redragon m 913"])("accepts %s on a known M913 PID", (name) => {
    expect(identifyM913({ ...areson, productName: name })).toMatchObject({ kind: "m913", revision: "areson" });
    expect(identifyM913({ ...compx, productName: name })).toMatchObject({ kind: "m913", revision: "compx" });
  });

  it("flags the Redragon M917 / K1NG M916 that share the Compx wired PID", () => {
    expect(identifyM913({ ...compx, productName: "Redragon M917 GB Pro" })).toMatchObject({ kind: "other-model" });
    expect(identifyM913({ ...compx, productName: "Redragon K1NG M916 PRO 1K Hz 3-Mode Wireless Gaming Mouse" })).toMatchObject({
      kind: "other-model",
    });
  });

  it("does not treat a different number containing 913 as an M913", () => {
    expect(identifyM913({ ...compx, productName: "M9130" }).kind).not.toBe("m913");
  });

  it("flags other Areson-based mice", () => {
    expect(identifyM913({ ...areson, productName: "UtechSmart Venus Pro" })).toMatchObject({ kind: "other-model" });
  });

  it.each(["", "   ", "Gaming Mouse", "CX 2.4G Wireless Receiver", "USB Receiver"])("requires confirmation for generic name %j", (name) => {
    const id = identifyM913({ ...compx, productName: name });
    expect(id.kind).toBe("unconfirmed");
    expect(id.reason).toContain("3554:f55e");
  });

  it("requires confirmation when the name says M913 but the PID is unknown", () => {
    expect(identifyM913({ vendorId: M913_VENDOR_IDS.compx, productId: 0xf5d5, productName: "M913" })).toMatchObject({ kind: "unconfirmed" });
  });

  it("rejects vendors the M913 doesn't use, even if the name says M913", () => {
    expect(identifyM913({ vendorId: 0x046d, productId: 0xc077, productName: "M913" })).toMatchObject({ kind: "other-model", revision: "unknown" });
  });
});
