/**
 * 演習ごとの進捗(docs/requirements.md 6章 `Progress { exerciseId, status, lastAttemptAt }`)を
 * 表す型と、AsyncStorageへの保存文字列との相互変換を行う純粋関数群。
 * React/AsyncStorageに依存しないため単体テストしやすく、`state/ProgressContext.tsx` から利用する。
 */

export type ProgressStatus = "正解" | "要復習";

export type ProgressRecord = {
  exerciseId: string;
  status: ProgressStatus;
  lastAttemptAt: string;
};

function isProgressStatus(value: unknown): value is ProgressStatus {
  return value === "正解" || value === "要復習";
}

function isProgressRecord(value: unknown): value is ProgressRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.exerciseId === "string" &&
    isProgressStatus(record.status) &&
    typeof record.lastAttemptAt === "string"
  );
}

/** AsyncStorageから読み込んだ生の文字列を検証しつつパースする。壊れたデータは無視して空配列を返す。 */
export function parseStoredProgress(raw: string | null): ProgressRecord[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProgressRecord);
  } catch {
    return [];
  }
}

export function serializeProgress(records: readonly ProgressRecord[]): string {
  return JSON.stringify(records);
}

/** 指定した演習の進捗を追加・上書きした新しい配列を返す(既存配列は変更しない)。 */
export function upsertProgressRecord(
  records: readonly ProgressRecord[],
  exerciseId: string,
  status: ProgressStatus,
  lastAttemptAt: string,
): ProgressRecord[] {
  const next = records.filter((record) => record.exerciseId !== exerciseId);
  next.push({ exerciseId, status, lastAttemptAt });
  return next;
}
