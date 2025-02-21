// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

/// <reference no-default-lib="true" />
/// <reference lib="esnext" />

declare namespace globalThis {
  declare namespace __bootstrap {
    declare var infra: {
      collectSequenceOfCodepoints(
        input: string,
        position: number,
        condition: (char: string) => boolean,
      ): {
        result: string;
        position: number;
      };
      ASCII_DIGIT: string[];
      ASCII_UPPER_ALPHA: string[];
      ASCII_LOWER_ALPHA: string[];
      ASCII_ALPHA: string[];
      ASCII_ALPHANUMERIC: string[];
      HTTP_TAB_OR_SPACE: string[];
      HTTP_WHITESPACE: string[];
      HTTP_TOKEN_CODE_POINT: string[];
      HTTP_TOKEN_CODE_POINT_RE: RegExp;
      HTTP_QUOTED_STRING_TOKEN_POINT: string[];
      HTTP_QUOTED_STRING_TOKEN_POINT_RE: RegExp;
      HTTP_TAB_OR_SPACE_PREFIX_RE: RegExp;
      HTTP_TAB_OR_SPACE_SUFFIX_RE: RegExp;
      HTTP_WHITESPACE_PREFIX_RE: RegExp;
      HTTP_WHITESPACE_SUFFIX_RE: RegExp;
      regexMatcher(chars: string[]): string;
      byteUpperCase(s: string): string;
      byteLowerCase(s: string): string;
      collectHttpQuotedString(
        input: string,
        position: number,
        extractValue: boolean,
      ): {
        result: string;
        position: number;
      };
      forgivingBase64Encode(data: Uint8Array): string;
      forgivingBase64Decode(data: string): Uint8Array;
    };

    declare namespace mimesniff {
      declare interface MimeType {
        type: string;
        subtype: string;
        parameters: Map<string, string>;
      }
      declare function parseMimeType(input: string): MimeType | null;
      declare function essence(mimeType: MimeType): string;
      declare function serializeMimeType(mimeType: MimeType): string;
    }

    declare var eventTarget: {
      EventTarget: typeof EventTarget;
    };

    declare var location: {
      getLocationHref(): string | undefined;
    };

    declare var base64: {
      atob(data: string): string;
      btoa(data: string): string;
    };

    declare var file: {
      Blob: typeof Blob & {
        [globalThis.__bootstrap.file._byteSequence]: Uint8Array;
      };
      readonly _byteSequence: unique symbol;
      File: typeof File & {
        [globalThis.__bootstrap.file._byteSequence]: Uint8Array;
      };
    };

    declare var streams: {
      ReadableStream: typeof ReadableStream;
      isReadableStreamDisturbed(stream: ReadableStream): boolean;
    };

    declare namespace messagePort {
      declare type Transferable = {
        kind: "messagePort";
        data: number;
      };
      declare interface MessageData {
        data: Uint8Array;
        transferables: Transferable[];
      }
    }
  }
}
