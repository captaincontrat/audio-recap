import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// Browser-side normalization tests. The real `mediabunny` runtime
// touches WebCodecs and a Worker-resident WASM encoder, neither of
// which exists in the jsdom environment vitest gives us. We replace
// the entire `mediabunny` and `@mediabunny/mp3-encoder` modules with
// observable fakes, then drive the four+1 real branches the design
// table calls out (success, init-throw, isValid===false, execute-
// throw, cancellation) plus the polyfill-registration gating.
//
// The fakes deliberately resemble the surface of the real modules
// rather than their internals: a `Conversion.init(...)` returns an
// object with `isValid`, `onProgress`, `execute()`, and `cancel()`,
// and the test can reach into the latest constructed instance to
// resolve, fail, or cancel its in-flight `execute()`. This keeps the
// tests readable while still exercising the real wiring inside
// `normalizeMediaForSubmission`.

const mocks = vi.hoisted(() => {
  // Fake classes live inside `vi.hoisted` so the `vi.mock` factories
  // below (also hoisted) can reference them. Declaring them at the
  // top of the file would put them in temporal-dead-zone when the
  // hoisted factories execute.
  class FakeConversionCanceledError extends Error {
    constructor() {
      super("Conversion canceled");
      this.name = "ConversionCanceledError";
    }
  }

  class FakeConversion {
    isValid: boolean;
    onProgress?: (n: number) => unknown;
    cancelCalls = 0;
    private readonly outputRef: { target: { buffer: ArrayBuffer | null } };
    private resolveExecute!: () => void;
    private rejectExecute!: (err: unknown) => void;
    private readonly executePromise: Promise<void>;

    constructor(output: { target: { buffer: ArrayBuffer | null } }, opts: { isValid: boolean }) {
      this.outputRef = output;
      this.isValid = opts.isValid;
      this.executePromise = new Promise<void>((resolve, reject) => {
        this.resolveExecute = resolve;
        this.rejectExecute = reject;
      });
    }

    execute(): Promise<void> {
      return this.executePromise;
    }

    async cancel(): Promise<void> {
      this.cancelCalls += 1;
      this.rejectExecute(new FakeConversionCanceledError());
    }

    // Test hooks. Resolve the in-flight `execute()` and (optionally)
    // populate the BufferTarget so the success path produces a non-
    // empty MP3 derivative.
    completeWith(buffer: ArrayBuffer | null): void {
      if (buffer !== null) {
        this.outputRef.target.buffer = buffer;
      }
      this.resolveExecute();
    }

    failWith(err: unknown): void {
      this.rejectExecute(err);
    }
  }

  const state = {
    canEncodeMp3: true,
    initThrows: null as Error | null,
    isValid: true,
    // Synchronous side-effect run inside our fake `Conversion.init`
    // so a test can prime the conversion's behavior (auto-complete,
    // wait-for-cancel, fail-on-execute, etc.) before the impl awaits
    // `execute()`. Stored as a setter the test can replace per case.
    onConversionInit: null as ((conv: FakeConversion) => void) | null,
  };

  let latestConversion: FakeConversion | null = null;

  const canEncodeAudio = vi.fn(async () => state.canEncodeMp3);
  const registerMp3Encoder = vi.fn();
  const initFn = vi.fn(async (opts: { input: unknown; output: { target: { buffer: ArrayBuffer | null } } }) => {
    if (state.initThrows) throw state.initThrows;
    const conv = new FakeConversion(opts.output, { isValid: state.isValid });
    latestConversion = conv;
    state.onConversionInit?.(conv);
    return conv;
  });

  return {
    state,
    FakeConversionCanceledError,
    canEncodeAudio,
    registerMp3Encoder,
    initFn,
    getLatestConversion: () => latestConversion,
    resetLatestConversion: () => {
      latestConversion = null;
    },
  };
});

vi.mock("mediabunny", () => ({
  ALL_FORMATS: [],
  BlobSource: class {
    constructor(public _blob: Blob) {}
  },
  BufferTarget: class {
    buffer: ArrayBuffer | null = null;
  },
  Input: class {
    constructor(public _opts: unknown) {}
  },
  Mp3OutputFormat: class {},
  Output: class {
    target: { buffer: ArrayBuffer | null };
    constructor(opts: { format: unknown; target: { buffer: ArrayBuffer | null } }) {
      this.target = opts.target;
    }
  },
  canEncodeAudio: mocks.canEncodeAudio,
  Conversion: { init: mocks.initFn },
  ConversionCanceledError: mocks.FakeConversionCanceledError,
}));

vi.mock("@mediabunny/mp3-encoder", () => ({
  registerMp3Encoder: mocks.registerMp3Encoder,
}));

import { normalizeMediaForSubmission } from "@/lib/client/media-normalization";

// jsdom does not ship `Worker` or `AudioDecoder`, so we install
// stand-ins for tests that need the prerequisite probe to pass. The
// `unavailable`-path test deliberately deletes `AudioDecoder` to
// exercise the real probe branch instead of stubbing it.
const ORIGINAL_GLOBALS: Record<string, unknown> = {};

function installGlobal(name: "Worker" | "AudioDecoder"): void {
  const target = globalThis as unknown as Record<string, unknown>;
  ORIGINAL_GLOBALS[name] = target[name];
  Object.defineProperty(target, name, {
    value: function PrereqStub() {},
    configurable: true,
    writable: true,
  });
}

function restoreGlobal(name: "Worker" | "AudioDecoder"): void {
  const target = globalThis as unknown as Record<string, unknown>;
  const original = ORIGINAL_GLOBALS[name];
  if (typeof original === "undefined") {
    Reflect.deleteProperty(target, name);
  } else {
    Object.defineProperty(target, name, { value: original, configurable: true, writable: true });
  }
}

function makeFile(name: string, type = "audio/mpeg", contents: BlobPart[] = ["bytes"]): File {
  return new File(contents, name, { type });
}

beforeEach(() => {
  installGlobal("Worker");
  installGlobal("AudioDecoder");

  mocks.state.canEncodeMp3 = true;
  mocks.state.initThrows = null;
  mocks.state.isValid = true;
  mocks.state.onConversionInit = null;
  mocks.canEncodeAudio.mockClear();
  mocks.registerMp3Encoder.mockClear();
  mocks.initFn.mockClear();
  mocks.resetLatestConversion();
});

afterEach(() => {
  restoreGlobal("Worker");
  restoreGlobal("AudioDecoder");
});

describe("normalizeMediaForSubmission (tasks 4.1–4.5)", () => {
  test("4.1 success returns mp3-derivative File with .mp3 name and audio/mpeg type", async () => {
    mocks.state.onConversionInit = (conv) => {
      conv.completeWith(new ArrayBuffer(128));
    };

    const original = makeFile("kickoff.mov", "video/quicktime");
    const result = await normalizeMediaForSubmission({ file: original, kind: "video" });

    expect(result.outcome).toEqual({ kind: "succeeded", inputKind: "mp3-derivative" });
    expect(result.file.name).toBe("kickoff.mp3");
    expect(result.file.type).toBe("audio/mpeg");
    expect(result.file).not.toBe(original);
    expect(mocks.initFn).toHaveBeenCalledTimes(1);
    expect(mocks.initFn.mock.calls[0]?.[0]).toMatchObject({
      audio: {
        bitrate: 64_000,
        numberOfChannels: 1,
        sampleRate: 32_000,
      },
    });
  });

  test("4.1b filenames without an extension still get a `.mp3` suffix", async () => {
    mocks.state.onConversionInit = (conv) => {
      conv.completeWith(new ArrayBuffer(64));
    };

    const original = makeFile("recording", "audio/mpeg");
    const result = await normalizeMediaForSubmission({ file: original, kind: "audio" });

    expect(result.file.name).toBe("recording.mp3");
  });

  test("4.2 returns unavailable when the environment probe fails (no AudioDecoder)", async () => {
    restoreGlobal("AudioDecoder");

    const original = makeFile("kickoff.mp3", "audio/mpeg");
    const result = await normalizeMediaForSubmission({ file: original, kind: "audio" });

    expect(result.outcome).toEqual({ kind: "unavailable" });
    expect(result.file).toBe(original);
    expect(mocks.initFn).not.toHaveBeenCalled();
    expect(mocks.canEncodeAudio).not.toHaveBeenCalled();
  });

  test("4.3 returns failed when conversion.execute throws a non-cancel error", async () => {
    mocks.state.onConversionInit = (conv) => {
      conv.failWith(new Error("decoder boom"));
    };

    const original = makeFile("kickoff.mp3", "audio/mpeg");
    const result = await normalizeMediaForSubmission({ file: original, kind: "audio" });

    expect(result.outcome).toEqual({ kind: "failed" });
    expect(result.file).toBe(original);
  });

  test("4.3b returns failed when Conversion.init itself throws", async () => {
    mocks.state.initThrows = new Error("init boom");

    const original = makeFile("kickoff.mp3", "audio/mpeg");
    const result = await normalizeMediaForSubmission({ file: original, kind: "audio" });

    expect(result.outcome).toEqual({ kind: "failed" });
    expect(result.file).toBe(original);
  });

  test("4.4 returns unavailable when conversion.isValid === false", async () => {
    mocks.state.isValid = false;

    const original = makeFile("kickoff.mp3", "audio/mpeg");
    const result = await normalizeMediaForSubmission({ file: original, kind: "audio" });

    expect(result.outcome).toEqual({ kind: "unavailable" });
    expect(result.file).toBe(original);
  });

  test("4.5 throws AbortError and calls conversion.cancel when the abort signal fires mid-conversion", async () => {
    const controller = new AbortController();
    mocks.state.onConversionInit = (_conv) => {
      // Trigger abort once init has returned and the listener is
      // registered — keep the deferred unresolved so cancel() must be
      // the path that ends `execute()`.
      queueMicrotask(() => controller.abort());
    };

    const original = makeFile("kickoff.mp3", "audio/mpeg");
    await expect(normalizeMediaForSubmission({ file: original, kind: "audio", signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });

    const conv = mocks.getLatestConversion();
    expect(conv).not.toBeNull();
    expect(conv?.cancelCalls).toBeGreaterThanOrEqual(1);
  });

  test("4.5b throws AbortError synchronously when the signal is already aborted before init", async () => {
    const controller = new AbortController();
    controller.abort();

    const original = makeFile("kickoff.mp3", "audio/mpeg");
    await expect(normalizeMediaForSubmission({ file: original, kind: "audio", signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });

    expect(mocks.initFn).not.toHaveBeenCalled();
    expect(mocks.canEncodeAudio).not.toHaveBeenCalled();
  });

  test("registers the LAME polyfill only when the browser cannot natively encode mp3", async () => {
    mocks.state.canEncodeMp3 = false;
    mocks.state.onConversionInit = (conv) => {
      conv.completeWith(new ArrayBuffer(64));
    };

    await normalizeMediaForSubmission({ file: makeFile("kickoff.mp3"), kind: "audio" });

    expect(mocks.registerMp3Encoder).toHaveBeenCalledTimes(1);
  });

  test("does not register the LAME polyfill when canEncodeAudio reports native support", async () => {
    mocks.state.canEncodeMp3 = true;
    mocks.state.onConversionInit = (conv) => {
      conv.completeWith(new ArrayBuffer(64));
    };

    await normalizeMediaForSubmission({ file: makeFile("kickoff.mp3"), kind: "audio" });

    expect(mocks.registerMp3Encoder).not.toHaveBeenCalled();
  });

  test("forwards Mediabunny conversion progress to the source.onProgress callback", async () => {
    const onProgress = vi.fn();
    mocks.state.onConversionInit = (conv) => {
      // Defer progress emission to a macrotask so the impl has time
      // to await `Conversion.init`, assign `conv.onProgress`, and
      // start awaiting `execute()` before we fire any tick. Mirrors
      // the real Mediabunny runtime, which emits progress from
      // inside the running `execute()` rather than synchronously
      // during `init`.
      setTimeout(() => {
        conv.onProgress?.(0.4);
        conv.onProgress?.(0.85);
        conv.completeWith(new ArrayBuffer(64));
      }, 0);
    };

    await normalizeMediaForSubmission({ file: makeFile("kickoff.mp3"), kind: "audio", onProgress });

    expect(onProgress).toHaveBeenCalledWith(0.4);
    expect(onProgress).toHaveBeenCalledWith(0.85);
  });

  test("returns failed when execute resolves but BufferTarget produced no bytes", async () => {
    // Defensive branch in the implementation: a successful execute
    // that left `output.target.buffer === null` is treated as a
    // failed conversion so the upload falls back to the original.
    mocks.state.onConversionInit = (conv) => {
      conv.completeWith(null);
    };

    const original = makeFile("kickoff.mp3", "audio/mpeg");
    const result = await normalizeMediaForSubmission({ file: original, kind: "audio" });

    expect(result.outcome).toEqual({ kind: "failed" });
    expect(result.file).toBe(original);
  });
});
