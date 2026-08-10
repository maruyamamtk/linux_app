import { describe, expect, it } from "vitest";

import { parseStoredProgress, serializeProgress, upsertProgressRecord } from "./progress";
import type { ProgressRecord } from "./progress";

describe("parseStoredProgress", () => {
  it("returns an empty array when there is nothing stored", () => {
    expect(parseStoredProgress(null)).toEqual([]);
  });

  it("returns an empty array for invalid JSON", () => {
    expect(parseStoredProgress("not json")).toEqual([]);
  });

  it("filters out entries that don't match the Progress shape", () => {
    const raw = JSON.stringify([
      { exerciseId: "ex1", status: "正解", lastAttemptAt: "2026-01-01T00:00:00.000Z" },
      { exerciseId: "ex2", status: "未着手", lastAttemptAt: "2026-01-01T00:00:00.000Z" },
      { exerciseId: "ex3" },
      "garbage",
    ]);
    expect(parseStoredProgress(raw)).toEqual([
      { exerciseId: "ex1", status: "正解", lastAttemptAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("round-trips through serializeProgress", () => {
    const records: ProgressRecord[] = [
      { exerciseId: "ex1", status: "正解", lastAttemptAt: "2026-01-01T00:00:00.000Z" },
      { exerciseId: "ex2", status: "要復習", lastAttemptAt: "2026-01-02T00:00:00.000Z" },
    ];
    expect(parseStoredProgress(serializeProgress(records))).toEqual(records);
  });
});

describe("upsertProgressRecord", () => {
  it("adds a new record for an unseen exerciseId", () => {
    const result = upsertProgressRecord([], "ex1", "正解", "2026-01-01T00:00:00.000Z");
    expect(result).toEqual([
      { exerciseId: "ex1", status: "正解", lastAttemptAt: "2026-01-01T00:00:00.000Z" },
    ]);
  });

  it("overwrites the previous status/timestamp for an existing exerciseId", () => {
    const existing: ProgressRecord[] = [
      { exerciseId: "ex1", status: "要復習", lastAttemptAt: "2026-01-01T00:00:00.000Z" },
    ];
    const result = upsertProgressRecord(existing, "ex1", "正解", "2026-01-02T00:00:00.000Z");
    expect(result).toEqual([
      { exerciseId: "ex1", status: "正解", lastAttemptAt: "2026-01-02T00:00:00.000Z" },
    ]);
  });

  it("does not mutate the input array", () => {
    const existing: ProgressRecord[] = [
      { exerciseId: "ex1", status: "正解", lastAttemptAt: "2026-01-01T00:00:00.000Z" },
    ];
    upsertProgressRecord(existing, "ex2", "要復習", "2026-01-02T00:00:00.000Z");
    expect(existing).toHaveLength(1);
  });
});
