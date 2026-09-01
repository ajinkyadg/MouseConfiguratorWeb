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

// One field within a report — the actual bit-level shape (size/count,
// usages) lives here, NOT on HIDReportInfo. A single report (one reportId)
// commonly packs several items of different widths, which is why this is
// a nested array rather than flat fields on the report itself — a mistake
// this file originally made, silently producing "reportSize=undefined"
// for every report regardless of device.
interface HIDReportItem {
  isAbsolute?: boolean;
  isArray?: boolean;
  isRange?: boolean;
  isVolatile?: boolean;
  hasNull?: boolean;
  usages?: number[];
  usageMinimum?: number;
  usageMaximum?: number;
  reportSize?: number;
  reportCount?: number;
  unitExponent?: number;
  unit?: number;
  min?: number;
  max?: number;
  logicalMinimum?: number;
  logicalMaximum?: number;
  physicalMinimum?: number;
  physicalMaximum?: number;
  strings?: string[];
}

interface HIDReportInfo {
  reportId?: number;
  items?: HIDReportItem[];
}

interface HIDCollectionInfo {
  usagePage: number;
  usage: number;
  inputReports: HIDReportInfo[];
  outputReports: HIDReportInfo[];
  featureReports: HIDReportInfo[];
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
