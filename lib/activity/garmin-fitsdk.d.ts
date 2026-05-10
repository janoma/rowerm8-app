/**
 * Minimal ambient type declaration for `@garmin/fitsdk` covering only the
 * surface our FIT writer touches. The package ships as plain JavaScript
 * with no .d.ts files, so this shim is what keeps tsc honest about the
 * encoder API.
 *
 * If we ever need decoder typings, add them here rather than reaching for
 * `any` at the call site.
 */
declare module "@garmin/fitsdk" {
  /** Mesg payloads are loosely typed at the encoder boundary; the SDK
   * inspects shape at runtime against its profile. */
  type FitMesg = Record<string, unknown> & { mesgNum?: number };

  type DeveloperFieldDescription = {
    developerDataIdMesg: FitMesg;
    fieldDescriptionMesg: FitMesg;
  };

  export class Encoder {
    constructor(options?: {
      fieldDescriptions?: Record<string, DeveloperFieldDescription>;
    });
    writeMesg(mesg: FitMesg): void;
    onMesg(mesgNum: number, mesg: FitMesg): void;
    /** Register a developer field after construction. */
    addDeveloperField(
      key: string,
      developerDataIdMesg: FitMesg,
      fieldDescriptionMesg: FitMesg,
    ): this;
    /** Flushes the file footer (CRC, etc.) and returns the encoded bytes. */
    close(): Uint8Array;
  }

  export const Profile: {
    MesgNum: {
      FILE_ID: number;
      DEVICE_INFO: number;
      EVENT: number;
      RECORD: number;
      LAP: number;
      SESSION: number;
      ACTIVITY: number;
      FIELD_DESCRIPTION: number;
      DEVELOPER_DATA_ID: number;
      [key: string]: number;
    };
    types: Record<string, unknown>;
  };

  export const Utils: {
    /** Milliseconds between the Unix epoch and the FIT epoch (1989-12-31 UTC). */
    FIT_EPOCH_MS: number;
    /** Convert a JS Date to FIT-epoch seconds (the encoder accepts either). */
    convertDateToDateTime: (date: Date) => number;
    convertDateTimeToDate: (datetime: number) => Date;
    FitBaseType: Record<string, number>;
  };

  export class Stream {
    static fromByteArray(bytes: number[] | Uint8Array): Stream;
    static fromArrayBuffer(buffer: ArrayBuffer): Stream;
  }

  export class Decoder {
    constructor(stream: Stream);
    static isFIT(stream: Stream): boolean;
    isFIT(): boolean;
    checkIntegrity(): boolean;
    read(options?: Record<string, unknown>): {
      messages: Record<string, FitMesg[]>;
      errors: unknown[];
    };
  }
}
