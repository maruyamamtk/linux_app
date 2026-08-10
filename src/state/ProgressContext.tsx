import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { parseStoredProgress, serializeProgress, upsertProgressRecord } from "./progress";
import type { ProgressRecord, ProgressStatus } from "./progress";

const STORAGE_KEY = "linuxdojo.progress.records.v1";

type ProgressContextValue = {
  isCleared: (exerciseId: string) => boolean;
  getStatus: (exerciseId: string) => ProgressStatus | "未着手";
  recordAttempt: (exerciseId: string, passed: boolean) => void;
  /** 直近の判定が「要復習」(不正解)のままになっている演習のID一覧。 */
  reviewExerciseIds: ReadonlySet<string>;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

/**
 * 演習ごとの進捗(docs/requirements.md 3章7節・6章 `Progress`)を保持し、
 * AsyncStorageへ永続化するコンテキスト。RootNavigatorの外側でラップして使う。
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<ProgressRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        setRecords(parseStoredProgress(stored));
      })
      .catch(() => {
        // 保存データの読み込みに失敗した場合は初期状態(未着手)のまま続行する
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function recordAttempt(exerciseId: string, passed: boolean) {
    setRecords((prev) => {
      const next = upsertProgressRecord(
        prev,
        exerciseId,
        passed ? "正解" : "要復習",
        new Date().toISOString(),
      );
      AsyncStorage.setItem(STORAGE_KEY, serializeProgress(next)).catch(() => {});
      return next;
    });
  }

  const value = useMemo<ProgressContextValue>(() => {
    const byExerciseId = new Map(records.map((record) => [record.exerciseId, record]));
    return {
      isCleared: (exerciseId) => byExerciseId.get(exerciseId)?.status === "正解",
      getStatus: (exerciseId) => byExerciseId.get(exerciseId)?.status ?? "未着手",
      recordAttempt,
      reviewExerciseIds: new Set(
        records.filter((record) => record.status === "要復習").map((record) => record.exerciseId),
      ),
    };
  }, [records]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
}
