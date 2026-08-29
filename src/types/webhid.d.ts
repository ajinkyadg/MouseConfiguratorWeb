// Minimal WebHID ambient types — TypeScript's bundled DOM lib doesn't
// reliably include these across versions, so they're declared directly
// rather than depending on lib version quirks.

interface HIDDeviceFilter {
  vendorId?: number;
  productId?: number;
}

interface HIDDeviceRequestOptions {
  filters: HIDDeviceFilter[];
}

interface HIDReportItem {
  reportId?: number;
  usages?: number[];
  reportSize?: number;
  reportCount?: number;
}

interface HIDCollectionInfo {
  usagePage: number;
  usage: number;
  inputReports: HIDReportItem[];
  outputReports: HIDReportItem[];
  featureReports: HIDReportItem[];
  children: HIDCollectionInfo[];
}

interface HIDInputReportEvent extends Event {
  readonly device: HIDDevice;
  readonly reportId: number;
  readonly data: DataView;
}

interface HIDDevice extends EventTarget {
  readonly opened: boolean;
  readonly vendorId: number;
  readonly productId: number;
  readonly productName: string;
  readonly collections: HIDCollectionInfo[];
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: BufferSource): Promise<void>;
  sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
  receiveFeatureReport(reportId: number): Promise<DataView>;
  oninputreport: ((this: HIDDevice, ev: HIDInputReportEvent) => unknown) | null;
  addEventListener(
    type: "inputreport",
    listener: (this: HIDDevice, ev: HIDInputReportEvent) => unknown
  ): void;
  removeEventListener(
    type: "inputreport",
    listener: (this: HIDDevice, ev: HIDInputReportEvent) => unknown
  ): void;
}

interface HID extends EventTarget {
  requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
  getDevices(): Promise<HIDDevice[]>;
}

interface Navigator {
  readonly hid: HID;
}
