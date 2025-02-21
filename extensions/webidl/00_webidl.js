// Copyright 2018-2021 the Deno authors. All rights reserved. MIT license.

// Adapted from https://github.com/jsdom/webidl-conversions.
// Copyright Domenic Denicola. Licensed under BSD-2-Clause License.
// Original license at https://github.com/jsdom/webidl-conversions/blob/master/LICENSE.md.

"use strict";

((window) => {
  function makeException(ErrorType, message, opts = {}) {
    if (opts.globals) {
      ErrorType = opts.globals[ErrorType.name];
    }
    return new ErrorType(
      `${opts.prefix ? opts.prefix + ": " : ""}${
        opts.context ? opts.context : "Value"
      } ${message}`,
    );
  }

  function toNumber(value, opts = {}) {
    if (!opts.globals) {
      return +value;
    }
    if (typeof value === "bigint") {
      throw opts.globals.TypeError("Cannot convert a BigInt value to a number");
    }
    return opts.globals.Number(value);
  }

  function type(V) {
    if (V === null) {
      return "Null";
    }
    switch (typeof V) {
      case "undefined":
        return "Undefined";
      case "boolean":
        return "Boolean";
      case "number":
        return "Number";
      case "string":
        return "String";
      case "symbol":
        return "Symbol";
      case "bigint":
        return "BigInt";
      case "object":
      // Falls through
      case "function":
      // Falls through
      default:
        // Per ES spec, typeof returns an implemention-defined value that is not any of the existing ones for
        // uncallable non-standard exotic objects. Yet Type() which the Web IDL spec depends on returns Object for
        // such cases. So treat the default case as an object.
        return "Object";
    }
  }

  // Round x to the nearest integer, choosing the even integer if it lies halfway between two.
  function evenRound(x) {
    // There are four cases for numbers with fractional part being .5:
    //
    // case |     x     | floor(x) | round(x) | expected | x <> 0 | x % 1 | x & 1 |   example
    //   1  |  2n + 0.5 |  2n      |  2n + 1  |  2n      |   >    |  0.5  |   0   |  0.5 ->  0
    //   2  |  2n + 1.5 |  2n + 1  |  2n + 2  |  2n + 2  |   >    |  0.5  |   1   |  1.5 ->  2
    //   3  | -2n - 0.5 | -2n - 1  | -2n      | -2n      |   <    | -0.5  |   0   | -0.5 ->  0
    //   4  | -2n - 1.5 | -2n - 2  | -2n - 1  | -2n - 2  |   <    | -0.5  |   1   | -1.5 -> -2
    // (where n is a non-negative integer)
    //
    // Branch here for cases 1 and 4
    if (
      (x > 0 && x % 1 === +0.5 && (x & 1) === 0) ||
      (x < 0 && x % 1 === -0.5 && (x & 1) === 1)
    ) {
      return censorNegativeZero(Math.floor(x));
    }

    return censorNegativeZero(Math.round(x));
  }

  function integerPart(n) {
    return censorNegativeZero(Math.trunc(n));
  }

  function sign(x) {
    return x < 0 ? -1 : 1;
  }

  function modulo(x, y) {
    // https://tc39.github.io/ecma262/#eqn-modulo
    // Note that http://stackoverflow.com/a/4467559/3191 does NOT work for large modulos
    const signMightNotMatch = x % y;
    if (sign(y) !== sign(signMightNotMatch)) {
      return signMightNotMatch + y;
    }
    return signMightNotMatch;
  }

  function censorNegativeZero(x) {
    return x === 0 ? 0 : x;
  }

  function createIntegerConversion(bitLength, typeOpts) {
    const isSigned = !typeOpts.unsigned;

    let lowerBound;
    let upperBound;
    if (bitLength === 64) {
      upperBound = Number.MAX_SAFE_INTEGER;
      lowerBound = !isSigned ? 0 : Number.MIN_SAFE_INTEGER;
    } else if (!isSigned) {
      lowerBound = 0;
      upperBound = Math.pow(2, bitLength) - 1;
    } else {
      lowerBound = -Math.pow(2, bitLength - 1);
      upperBound = Math.pow(2, bitLength - 1) - 1;
    }

    const twoToTheBitLength = Math.pow(2, bitLength);
    const twoToOneLessThanTheBitLength = Math.pow(2, bitLength - 1);

    return (V, opts = {}) => {
      let x = toNumber(V, opts);
      x = censorNegativeZero(x);

      if (opts.enforceRange) {
        if (!Number.isFinite(x)) {
          throw makeException(TypeError, "is not a finite number", opts);
        }

        x = integerPart(x);

        if (x < lowerBound || x > upperBound) {
          throw makeException(
            TypeError,
            `is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`,
            opts,
          );
        }

        return x;
      }

      if (!Number.isNaN(x) && opts.clamp) {
        x = Math.min(Math.max(x, lowerBound), upperBound);
        x = evenRound(x);
        return x;
      }

      if (!Number.isFinite(x) || x === 0) {
        return 0;
      }
      x = integerPart(x);

      // Math.pow(2, 64) is not accurately representable in JavaScript, so try to avoid these per-spec operations if
      // possible. Hopefully it's an optimization for the non-64-bitLength cases too.
      if (x >= lowerBound && x <= upperBound) {
        return x;
      }

      // These will not work great for bitLength of 64, but oh well. See the README for more details.
      x = modulo(x, twoToTheBitLength);
      if (isSigned && x >= twoToOneLessThanTheBitLength) {
        return x - twoToTheBitLength;
      }
      return x;
    };
  }

  function createLongLongConversion(bitLength, { unsigned }) {
    const upperBound = Number.MAX_SAFE_INTEGER;
    const lowerBound = unsigned ? 0 : Number.MIN_SAFE_INTEGER;
    const asBigIntN = unsigned ? BigInt.asUintN : BigInt.asIntN;

    return (V, opts = {}) => {
      let x = toNumber(V, opts);
      x = censorNegativeZero(x);

      if (opts.enforceRange) {
        if (!Number.isFinite(x)) {
          throw makeException(TypeError, "is not a finite number", opts);
        }

        x = integerPart(x);

        if (x < lowerBound || x > upperBound) {
          throw makeException(
            TypeError,
            `is outside the accepted range of ${lowerBound} to ${upperBound}, inclusive`,
            opts,
          );
        }

        return x;
      }

      if (!Number.isNaN(x) && opts.clamp) {
        x = Math.min(Math.max(x, lowerBound), upperBound);
        x = evenRound(x);
        return x;
      }

      if (!Number.isFinite(x) || x === 0) {
        return 0;
      }

      let xBigInt = BigInt(integerPart(x));
      xBigInt = asBigIntN(bitLength, xBigInt);
      return Number(xBigInt);
    };
  }

  const converters = [];

  converters.any = (V) => {
    return V;
  };

  converters.boolean = function (val) {
    return !!val;
  };

  converters.byte = createIntegerConversion(8, { unsigned: false });
  converters.octet = createIntegerConversion(8, { unsigned: true });

  converters.short = createIntegerConversion(16, { unsigned: false });
  converters["unsigned short"] = createIntegerConversion(16, {
    unsigned: true,
  });

  converters.long = createIntegerConversion(32, { unsigned: false });
  converters["unsigned long"] = createIntegerConversion(32, { unsigned: true });

  converters["long long"] = createLongLongConversion(64, { unsigned: false });
  converters["unsigned long long"] = createLongLongConversion(64, {
    unsigned: true,
  });

  converters.float = (V, opts) => {
    const x = toNumber(V, opts);

    if (!Number.isFinite(x)) {
      throw makeException(
        TypeError,
        "is not a finite floating-point value",
        opts,
      );
    }

    if (Object.is(x, -0)) {
      return x;
    }

    const y = Math.fround(x);

    if (!Number.isFinite(y)) {
      throw makeException(
        TypeError,
        "is outside the range of a single-precision floating-point value",
        opts,
      );
    }

    return y;
  };

  converters["unrestricted float"] = (V, opts) => {
    const x = toNumber(V, opts);

    if (isNaN(x)) {
      return x;
    }

    if (Object.is(x, -0)) {
      return x;
    }

    return Math.fround(x);
  };

  converters.double = (V, opts) => {
    const x = toNumber(V, opts);

    if (!Number.isFinite(x)) {
      throw makeException(
        TypeError,
        "is not a finite floating-point value",
        opts,
      );
    }

    return x;
  };

  converters["unrestricted double"] = (V, opts) => {
    const x = toNumber(V, opts);

    return x;
  };

  converters.DOMString = function (V, opts = {}) {
    if (opts.treatNullAsEmptyString && V === null) {
      return "";
    }

    if (typeof V === "symbol") {
      throw makeException(
        TypeError,
        "is a symbol, which cannot be converted to a string",
        opts,
      );
    }

    const StringCtor = opts.globals ? opts.globals.String : String;
    return StringCtor(V);
  };

  converters.ByteString = (V, opts) => {
    const x = converters.DOMString(V, opts);
    let c;
    for (let i = 0; (c = x.codePointAt(i)) !== undefined; ++i) {
      if (c > 255) {
        throw makeException(TypeError, "is not a valid ByteString", opts);
      }
    }

    return x;
  };

  converters.USVString = (V, opts) => {
    const S = converters.DOMString(V, opts);
    const n = S.length;
    let U = "";
    for (let i = 0; i < n; ++i) {
      const c = S.charCodeAt(i);
      if (c < 0xd800 || c > 0xdfff) {
        U += String.fromCodePoint(c);
      } else if (0xdc00 <= c && c <= 0xdfff) {
        U += String.fromCodePoint(0xfffd);
      } else if (i === n - 1) {
        U += String.fromCodePoint(0xfffd);
      } else {
        const d = S.charCodeAt(i + 1);
        if (0xdc00 <= d && d <= 0xdfff) {
          const a = c & 0x3ff;
          const b = d & 0x3ff;
          U += String.fromCodePoint((2 << 15) + (2 << 9) * a + b);
          ++i;
        } else {
          U += String.fromCodePoint(0xfffd);
        }
      }
    }
    return U;
  };

  converters.object = (V, opts) => {
    if (type(V) !== "Object") {
      throw makeException(TypeError, "is not an object", opts);
    }

    return V;
  };

  // Not exported, but used in Function and VoidFunction.

  // Neither Function nor VoidFunction is defined with [TreatNonObjectAsNull], so
  // handling for that is omitted.
  function convertCallbackFunction(V, opts) {
    if (typeof V !== "function") {
      throw makeException(TypeError, "is not a function", opts);
    }
    return V;
  }

  function isNonSharedArrayBuffer(V) {
    return V instanceof ArrayBuffer;
  }

  function isSharedArrayBuffer(V) {
    return V instanceof SharedArrayBuffer;
  }

  function isArrayBufferDetached(V) {
    try {
      new Uint8Array(V);
      return false;
    } catch {
      return true;
    }
  }

  converters.ArrayBuffer = (V, opts = {}) => {
    if (!isNonSharedArrayBuffer(V)) {
      if (opts.allowShared && !isSharedArrayBuffer(V)) {
        throw makeException(
          TypeError,
          "is not an ArrayBuffer or SharedArrayBuffer",
          opts,
        );
      }
      throw makeException(TypeError, "is not an ArrayBuffer", opts);
    }
    if (isArrayBufferDetached(V)) {
      throw makeException(TypeError, "is a detached ArrayBuffer", opts);
    }

    return V;
  };

  converters.DataView = (V, opts = {}) => {
    if (!(V instanceof DataView)) {
      throw makeException(TypeError, "is not a DataView", opts);
    }

    if (!opts.allowShared && isSharedArrayBuffer(V.buffer)) {
      throw makeException(
        TypeError,
        "is backed by a SharedArrayBuffer, which is not allowed",
        opts,
      );
    }
    if (isArrayBufferDetached(V.buffer)) {
      throw makeException(
        TypeError,
        "is backed by a detached ArrayBuffer",
        opts,
      );
    }

    return V;
  };

  // Returns the unforgeable `TypedArray` constructor name or `undefined`,
  // if the `this` value isn't a valid `TypedArray` object.
  //
  // https://tc39.es/ecma262/#sec-get-%typedarray%.prototype-@@tostringtag
  const typedArrayNameGetter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Uint8Array).prototype,
    Symbol.toStringTag,
  ).get;
  [
    Int8Array,
    Int16Array,
    Int32Array,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Uint8ClampedArray,
    Float32Array,
    Float64Array,
  ].forEach((func) => {
    const name = func.name;
    const article = /^[AEIOU]/.test(name) ? "an" : "a";
    converters[name] = (V, opts = {}) => {
      if (!ArrayBuffer.isView(V) || typedArrayNameGetter.call(V) !== name) {
        throw makeException(
          TypeError,
          `is not ${article} ${name} object`,
          opts,
        );
      }
      if (!opts.allowShared && isSharedArrayBuffer(V.buffer)) {
        throw makeException(
          TypeError,
          "is a view on a SharedArrayBuffer, which is not allowed",
          opts,
        );
      }
      if (isArrayBufferDetached(V.buffer)) {
        throw makeException(
          TypeError,
          "is a view on a detached ArrayBuffer",
          opts,
        );
      }

      return V;
    };
  });

  // Common definitions

  converters.ArrayBufferView = (V, opts = {}) => {
    if (!ArrayBuffer.isView(V)) {
      throw makeException(
        TypeError,
        "is not a view on an ArrayBuffer or SharedArrayBuffer",
        opts,
      );
    }

    if (!opts.allowShared && isSharedArrayBuffer(V.buffer)) {
      throw makeException(
        TypeError,
        "is a view on a SharedArrayBuffer, which is not allowed",
        opts,
      );
    }

    if (isArrayBufferDetached(V.buffer)) {
      throw makeException(
        TypeError,
        "is a view on a detached ArrayBuffer",
        opts,
      );
    }
    return V;
  };

  converters.BufferSource = (V, opts = {}) => {
    if (ArrayBuffer.isView(V)) {
      if (!opts.allowShared && isSharedArrayBuffer(V.buffer)) {
        throw makeException(
          TypeError,
          "is a view on a SharedArrayBuffer, which is not allowed",
          opts,
        );
      }

      if (isArrayBufferDetached(V.buffer)) {
        throw makeException(
          TypeError,
          "is a view on a detached ArrayBuffer",
          opts,
        );
      }
      return V;
    }

    if (!opts.allowShared && !isNonSharedArrayBuffer(V)) {
      throw makeException(
        TypeError,
        "is not an ArrayBuffer or a view on one",
        opts,
      );
    }
    if (
      opts.allowShared &&
      !isSharedArrayBuffer(V) &&
      !isNonSharedArrayBuffer(V)
    ) {
      throw makeException(
        TypeError,
        "is not an ArrayBuffer, SharedArrayBuffer, or a view on one",
        opts,
      );
    }
    if (isArrayBufferDetached(V)) {
      throw makeException(TypeError, "is a detached ArrayBuffer", opts);
    }

    return V;
  };

  converters.DOMTimeStamp = converters["unsigned long long"];

  converters.Function = convertCallbackFunction;

  converters.VoidFunction = convertCallbackFunction;

  converters["UVString?"] = createNullableConverter(
    converters.USVString,
  );
  converters["sequence<double>"] = createSequenceConverter(
    converters.double,
  );
  converters["sequence<object>"] = createSequenceConverter(
    converters.object,
  );
  converters["Promise<undefined>"] = createPromiseConverter(() => undefined);

  converters["sequence<ByteString>"] = createSequenceConverter(
    converters.ByteString,
  );
  converters["sequence<sequence<ByteString>>"] = createSequenceConverter(
    converters["sequence<ByteString>"],
  );
  converters["record<ByteString, ByteString>"] = createRecordConverter(
    converters.ByteString,
    converters.ByteString,
  );

  converters["sequence<DOMString>"] = createSequenceConverter(
    converters.DOMString,
  );

  function requiredArguments(length, required, opts = {}) {
    if (length < required) {
      const errMsg = `${
        opts.prefix ? opts.prefix + ": " : ""
      }${required} argument${
        required === 1 ? "" : "s"
      } required, but only ${length} present.`;
      throw new TypeError(errMsg);
    }
  }

  function createDictionaryConverter(name, ...dictionaries) {
    let hasRequiredKey = false;
    const allMembers = [];
    for (const members of dictionaries) {
      for (const member of members) {
        if (member.required) {
          hasRequiredKey = true;
        }
        allMembers.push(member);
      }
    }
    allMembers.sort((a, b) => {
      if (a.key == b.key) {
        return 0;
      }
      return a.key < b.key ? -1 : 1;
    });

    const defaultValues = {};
    for (const member of allMembers) {
      if ("defaultValue" in member) {
        const idlMemberValue = member.defaultValue;
        const imvType = typeof idlMemberValue;
        // Copy by value types can be directly assigned, copy by reference types
        // need to be re-created for each allocation.
        if (
          imvType === "number" || imvType === "boolean" ||
          imvType === "string" || imvType === "bigint" ||
          imvType === "undefined"
        ) {
          defaultValues[member.key] = idlMemberValue;
        } else {
          Object.defineProperty(defaultValues, member.key, {
            get() {
              return member.defaultValue;
            },
            enumerable: true,
          });
        }
      }
    }

    return function (V, opts = {}) {
      const typeV = type(V);
      switch (typeV) {
        case "Undefined":
        case "Null":
        case "Object":
          break;
        default:
          throw makeException(
            TypeError,
            "can not be converted to a dictionary",
            opts,
          );
      }
      const esDict = V;

      const idlDict = { ...defaultValues };

      // NOTE: fast path Null and Undefined.
      if ((V === undefined || V === null) && !hasRequiredKey) {
        return idlDict;
      }

      for (const member of allMembers) {
        const key = member.key;

        let esMemberValue;
        if (typeV === "Undefined" || typeV === "Null") {
          esMemberValue = undefined;
        } else {
          esMemberValue = esDict[key];
        }

        if (esMemberValue !== undefined) {
          const context = `'${key}' of '${name}'${
            opts.context ? ` (${opts.context})` : ""
          }`;
          const converter = member.converter;
          const idlMemberValue = converter(esMemberValue, { ...opts, context });
          idlDict[key] = idlMemberValue;
        } else if (member.required) {
          throw makeException(
            TypeError,
            `can not be converted to '${name}' because '${key}' is required in '${name}'.`,
            { ...opts },
          );
        }
      }

      return idlDict;
    };
  }

  // https://heycam.github.io/webidl/#es-enumeration
  function createEnumConverter(name, values) {
    const E = new Set(values);

    return function (V, opts = {}) {
      const S = String(V);

      if (!E.has(S)) {
        throw new TypeError(
          `${
            opts.prefix ? opts.prefix + ": " : ""
          }The provided value '${S}' is not a valid enum value of type ${name}.`,
        );
      }

      return S;
    };
  }

  function createNullableConverter(converter) {
    return (V, opts = {}) => {
      // FIXME: If Type(V) is not Object, and the conversion to an IDL value is
      // being performed due to V being assigned to an attribute whose type is a
      // nullable callback function that is annotated with
      // [LegacyTreatNonObjectAsNull], then return the IDL nullable type T?
      // value null.

      if (V === null || V === undefined) return null;
      return converter(V, opts);
    };
  }

  // https://heycam.github.io/webidl/#es-sequence
  function createSequenceConverter(converter) {
    return function (V, opts = {}) {
      if (type(V) !== "Object") {
        throw makeException(
          TypeError,
          "can not be converted to sequence.",
          opts,
        );
      }
      const iter = V?.[Symbol.iterator]?.();
      if (iter === undefined) {
        throw makeException(
          TypeError,
          "can not be converted to sequence.",
          opts,
        );
      }
      const array = [];
      while (true) {
        const res = iter?.next?.();
        if (res === undefined) {
          throw makeException(
            TypeError,
            "can not be converted to sequence.",
            opts,
          );
        }
        if (res.done === true) break;
        const val = converter(res.value, {
          ...opts,
          context: `${opts.context}, index ${array.length}`,
        });
        array.push(val);
      }
      return array;
    };
  }

  function createRecordConverter(keyConverter, valueConverter) {
    return (V, opts) => {
      if (type(V) !== "Object") {
        throw makeException(
          TypeError,
          "can not be converted to dictionary.",
          opts,
        );
      }
      const keys = Reflect.ownKeys(V);
      const result = {};
      for (const key of keys) {
        const desc = Object.getOwnPropertyDescriptor(V, key);
        if (desc !== undefined && desc.enumerable === true) {
          const typedKey = keyConverter(key, opts);
          const value = V[key];
          const typedValue = valueConverter(value, opts);
          result[typedKey] = typedValue;
        }
      }
      return result;
    };
  }

  function createPromiseConverter(converter) {
    return (V, opts) => Promise.resolve(V).then((V) => converter(V, opts));
  }

  function invokeCallbackFunction(
    callable,
    args,
    thisArg,
    returnValueConverter,
    opts,
  ) {
    try {
      const rv = Reflect.apply(callable, thisArg, args);
      return returnValueConverter(rv, {
        prefix: opts.prefix,
        context: "return value",
      });
    } catch (err) {
      if (opts.returnsPromise === true) {
        return Promise.reject(err);
      }
      throw err;
    }
  }

  const brand = Symbol("[[webidl.brand]]");

  function createInterfaceConverter(name, prototype) {
    return (V, opts) => {
      if (!(V instanceof prototype) || V[brand] !== brand) {
        throw makeException(TypeError, `is not of type ${name}.`, opts);
      }
      return V;
    };
  }

  function createBranded(Type) {
    const t = Object.create(Type.prototype);
    t[brand] = brand;
    return t;
  }

  function assertBranded(self, prototype) {
    if (!(self instanceof prototype) || self[brand] !== brand) {
      throw new TypeError("Illegal invocation");
    }
  }

  function illegalConstructor() {
    throw new TypeError("Illegal constructor");
  }

  function define(target, source) {
    for (const key of Reflect.ownKeys(source)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(source, key);
      if (descriptor && !Reflect.defineProperty(target, key, descriptor)) {
        throw new TypeError(`Cannot redefine property: ${String(key)}`);
      }
    }
  }

  const _iteratorInternal = Symbol("iterator internal");

  const globalIteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf(
    [][Symbol.iterator](),
  ));

  function mixinPairIterable(name, prototype, dataSymbol, keyKey, valueKey) {
    const iteratorPrototype = Object.create(globalIteratorPrototype, {
      [Symbol.toStringTag]: { configurable: true, value: `${name} Iterator` },
    });
    define(iteratorPrototype, {
      next() {
        const internal = this && this[_iteratorInternal];
        if (!internal) {
          throw new TypeError(
            `next() called on a value that is not a ${name} iterator object`,
          );
        }
        const { target, kind, index } = internal;
        const values = target[dataSymbol];
        const len = values.length;
        if (index >= len) {
          return { value: undefined, done: true };
        }
        const pair = values[index];
        internal.index = index + 1;
        let result;
        switch (kind) {
          case "key":
            result = pair[keyKey];
            break;
          case "value":
            result = pair[valueKey];
            break;
          case "key+value":
            result = [pair[keyKey], pair[valueKey]];
            break;
        }
        return { value: result, done: false };
      },
    });
    function createDefaultIterator(target, kind) {
      const iterator = Object.create(iteratorPrototype);
      Object.defineProperty(iterator, _iteratorInternal, {
        value: { target, kind, index: 0 },
        configurable: true,
      });
      return iterator;
    }

    function entries() {
      assertBranded(this, prototype);
      return createDefaultIterator(this, "key+value");
    }

    const properties = {
      entries: {
        value: entries,
        writable: true,
        enumerable: true,
        configurable: true,
      },
      [Symbol.iterator]: {
        value: entries,
        writable: true,
        enumerable: false,
        configurable: true,
      },
      keys: {
        value: function keys() {
          assertBranded(this, prototype);
          return createDefaultIterator(this, "key");
        },
        writable: true,
        enumerable: true,
        configurable: true,
      },
      values: {
        value: function values() {
          assertBranded(this, prototype);
          return createDefaultIterator(this, "value");
        },
        writable: true,
        enumerable: true,
        configurable: true,
      },
      forEach: {
        value: function forEach(idlCallback, thisArg = undefined) {
          assertBranded(this, prototype);
          const prefix = `Failed to execute 'forEach' on '${name}'`;
          requiredArguments(arguments.length, 1, { prefix });
          idlCallback = converters["Function"](idlCallback, {
            prefix,
            context: "Argument 1",
          });
          idlCallback = idlCallback.bind(thisArg ?? globalThis);
          const pairs = this[dataSymbol];
          for (let i = 0; i < pairs.length; i++) {
            const entry = pairs[i];
            idlCallback(entry[valueKey], entry[keyKey], this);
          }
        },
        writable: true,
        enumerable: true,
        configurable: true,
      },
    };
    return Object.defineProperties(prototype.prototype, properties);
  }

  function configurePrototype(prototype) {
    const descriptors = Object.getOwnPropertyDescriptors(prototype.prototype);
    for (const key in descriptors) {
      if (key === "constructor") continue;
      const descriptor = descriptors[key];
      if ("value" in descriptor && typeof descriptor.value === "function") {
        Object.defineProperty(prototype.prototype, key, {
          enumerable: true,
          writable: true,
          configurable: true,
        });
      } else if ("get" in descriptor) {
        Object.defineProperty(prototype.prototype, key, {
          enumerable: true,
          configurable: true,
        });
      }
    }
  }

  window.__bootstrap ??= {};
  window.__bootstrap.webidl = {
    type,
    makeException,
    converters,
    requiredArguments,
    createDictionaryConverter,
    createEnumConverter,
    createNullableConverter,
    createSequenceConverter,
    createRecordConverter,
    createPromiseConverter,
    invokeCallbackFunction,
    createInterfaceConverter,
    brand,
    createBranded,
    assertBranded,
    illegalConstructor,
    mixinPairIterable,
    configurePrototype,
  };
})(this);
