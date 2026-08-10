import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "linuxdojo.progress.clearedExerciseIds.v1";

type ProgressContextValue = {
  clearedExerciseIds: ReadonlySet<string>;
  isCleared: (exerciseId: string) => boolean;
  markCleared: (exerciseId: string) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

/**
 * 演習ごとのクリア状況(docs/requirements.md 3章7節・6章 `Progress`)を保持し、
 * AsyncStorageへ永続化するコンテキスト。RootNavigatorの外側でラップして使う。
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [clearedExerciseIds, setClearedExerciseIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled || !stored) return;
        const ids: unknown = JSON.parse(stored);
        if (Array.isArray(ids)) {
          setClearedExerciseIds(new Set(ids.filter((id): id is string => typeof id === "string")));
        }
      })
      .catch(() => {
        // 保存データの読み込みに失敗した場合は初期状態(未クリア)のまま続行する
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function markCleared(exerciseId: string) {
    setClearedExerciseIds((prev) => {
      if (prev.has(exerciseId)) return prev;
      const next = new Set(prev);
      next.add(exerciseId);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }

  const value = useMemo<ProgressContextValue>(
    () => ({
      clearedExerciseIds,
      isCleared: (exerciseId) => clearedExerciseIds.has(exerciseId),
      markCleared,
    }),
    [clearedExerciseIds],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error("useProgress must be used within a ProgressProvider");
  }
  return context;
}
