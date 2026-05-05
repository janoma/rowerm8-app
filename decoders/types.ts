export type AccelSample = {
  x: number;
  y: number;
  z: number;
  magnitude: number;
};

export type DecodedFrame = {
  accel?: AccelSample;
  angularVelocity?: { x: number; y: number; z: number };
  angle?: { roll: number; pitch: number; yaw: number };
};

export type DecoderDeviceHint = {
  name: string | null;
  localName?: string | null;
  serviceUUIDs?: string[] | null;
};

export type SensorDecoder = {
  key: string;
  displayName: string;
  vendorDescription: string;
  recommended: boolean;
  serviceUuid: string;
  notifyUuid: string;
  writeUuid?: string;
  initCommands?: Uint8Array[];
  matches: (device: DecoderDeviceHint) => boolean;
  /**
   * Decode all complete frames present in a single BLE notification payload.
   * iOS in particular often coalesces multiple frames into one notification when
   * the device's output rate exceeds the connection interval, so decoders must
   * emit every frame they can find rather than only the first one.
   */
  decode: (bytes: Uint8Array) => DecodedFrame[];
};
