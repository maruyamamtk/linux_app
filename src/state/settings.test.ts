import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISPLAY_SETTINGS,
  clampTerminalFontSize,
  parseStoredDisplaySettings,
  serializeDisplaySettings,
} from "./settings";
import type { DisplaySettings } from "./settings";

describe("clampTerminalFontSize", () => {
  it("clamps values below the minimum", () => {
    expect(clampTerminalFontSize(1)).toBe(11);
  });

  it("clamps values above the maximum", () => {
    expect(clampTerminalFontSize(100)).toBe(19);
  });

  it("rounds fractional values", () => {
    expect(clampTerminalFontSize(14.6)).toBe(15);
  });

  it("falls back to the default for non-finite values", () => {
    expect(clampTerminalFontSize(NaN)).toBe(13);
  });
});

describe("parseStoredDisplaySettings", () => {
  it("returns the default settings when nothing is stored", () => {
    expect(parseStoredDisplaySettings(null)).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it("returns the default settings for invalid JSON", () => {
    expect(parseStoredDisplaySettings("not json")).toEqual(DEFAULT_DISPLAY_SETTINGS);
  });

  it("falls back to defaults for an invalid themeMode", () => {
    const raw = JSON.stringify({ themeMode: "purple", terminalFontSize: 15 });
    expect(parseStoredDisplaySettings(raw)).toEqual({ themeMode: "system", terminalFontSize: 15 });
  });

  it("clamps an out-of-range stored terminalFontSize", () => {
    const raw = JSON.stringify({ themeMode: "dark", terminalFontSize: 999 });
    expect(parseStoredDisplaySettings(raw)).toEqual({ themeMode: "dark", terminalFontSize: 19 });
  });

  it("round-trips through serializeDisplaySettings", () => {
    const settings: DisplaySettings = { themeMode: "light", terminalFontSize: 17 };
    expect(parseStoredDisplaySettings(serializeDisplaySettings(settings))).toEqual(settings);
  });
});
