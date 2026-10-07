import { describe, it, expect, vi, afterEach } from "vitest";
import { sendM908Rows, M908_ROW_GAP_MS } from "./m908-transport";

function fakeDevice() {
  const sent: { reportId: number; bytes: number[]; at: number }[] = [];
  const device = {
    sendFeatureReport: vi.fn(async (reportId: number, data: Uint8Array) => {
      sent.push({ reportId, bytes: [...data], at: Date.now() });
    }),
  } as unknown as HIDDevice;
  return { device, sent };
}

const row = (reportId: number, length: number, fill: number) => [reportId, ...Array<number>(length - 1).fill(fill)];

describe("sendM908Rows", () => {
  afterEach(() => vi.useRealTimers());

  it("sends every row in order, with byte 0 as the report ID and the rest as payload", async () => {
    const { device, sent } = fakeDevice();
    await sendM908Rows(device, [row(2, 16, 0xaa), row(3, 64, 0xbb), row(2, 16, 0xcc)], 0);
    expect(sent.map((s) => [s.reportId, s.bytes.length, s.bytes[0]])).toEqual([
      [2, 15, 0xaa],
      [3, 63, 0xbb],
      [2, 15, 0xcc],
    ]);
  });

  it("waits the official software's gap between packets by default", async () => {
    vi.useFakeTimers();
    const { device, sent } = fakeDevice();
    const done = sendM908Rows(device, [row(2, 16, 1), row(2, 16, 2), row(2, 16, 3)]);
    await vi.runAllTimersAsync();
    await done;
    expect(sent).toHaveLength(3);
    expect(sent[1].at - sent[0].at).toBe(M908_ROW_GAP_MS);
    expect(sent[2].at - sent[1].at).toBe(M908_ROW_GAP_MS);
    expect(M908_ROW_GAP_MS).toBe(30);
  });

  it("stops at the first failed packet and reports the error", async () => {
    const { device, sent } = fakeDevice();
    (device.sendFeatureReport as ReturnType<typeof vi.fn>).mockImplementationOnce(async () => {}).mockRejectedValueOnce(new Error("Failed to write the feature report."));
    await expect(sendM908Rows(device, [row(2, 16, 1), row(2, 16, 2), row(2, 16, 3)], 0)).rejects.toThrow("Failed to write");
    expect(sent).toHaveLength(0);
    expect(device.sendFeatureReport).toHaveBeenCalledTimes(2);
  });
});
