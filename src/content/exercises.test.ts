import { describe, expect, it } from "vitest";

import type { CommandContext } from "../engine/commands";
import { executeShellInput } from "../engine/interpreter";
import { applyKey, bufferToFileText, createInitialState } from "../engine/vim";
import type { VimKey } from "../engine/vim";
import { VirtualFileSystem } from "../engine/vfs";
import type { VfsUser } from "../engine/vfs";
import { chapters } from "./chapters";
import { exercises } from "./exercises";
import type { Exercise } from "./exercises";
import { getVfsSnapshot } from "./vfsSeed";

const STUDY_USER: VfsUser = { name: "study", groups: ["study"] };
const HOME_DIR = "/home/study";

function buildContext(exercise: Exercise): CommandContext {
  const snapshot = getVfsSnapshot(exercise.chapterId, exercise.vfsSnapshotId);
  return {
    vfs: new VirtualFileSystem(snapshot, STUDY_USER),
    cwd: exercise.initialCwd ?? HOME_DIR,
    env: { HOME: HOME_DIR, PATH: "/bin:/usr/bin" },
    processes: (exercise.processes ?? []).map((process) => ({ ...process })),
    ssh: {},
  };
}

/** 未知のコマンド・パス誤り・権限エラー等を検出する(演習の誤字・タイポの検知が目的)。 */
function expectNoEngineError(stderr: string): void {
  expect(stderr).not.toMatch(/command not found/);
  expect(stderr).not.toMatch(/^bash:/);
  expect(stderr).not.toMatch(/No such file or directory/);
  expect(stderr).not.toMatch(/Permission denied/);
  expect(stderr).not.toMatch(/Not a directory/);
}

describe("chapters / exercises consistency", () => {
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));

  it("every exercise references an existing chapter", () => {
    for (const exercise of exercises) {
      expect(chapterIds.has(exercise.chapterId), `${exercise.id} -> chapterId "${exercise.chapterId}"`).toBe(true);
    }
  });

  it("has no duplicate exercise ids", () => {
    const ids = exercises.map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every chapter has at least one exercise", () => {
    for (const chapter of chapters) {
      const count = exercises.filter((exercise) => exercise.chapterId === chapter.id).length;
      expect(count, `chapter "${chapter.id}" has no exercises`).toBeGreaterThan(0);
    }
  });
});

describe("terminal exercises", () => {
  const terminalExercises = exercises.filter((exercise) => (exercise.type ?? "terminal") === "terminal");

  it.each(terminalExercises)("$id: initialCwd is a valid directory in its VFS snapshot", (exercise) => {
    const cwd = exercise.initialCwd ?? HOME_DIR;
    const snapshot = getVfsSnapshot(exercise.chapterId, exercise.vfsSnapshotId);
    const vfs = new VirtualFileSystem(snapshot, STUDY_USER);
    expect(vfs.stat(cwd).type).toBe("directory");
  });

  it.each(terminalExercises)("$id: has a referenceSolution", (exercise) => {
    expect(exercise.referenceSolution).toBeTruthy();
  });

  it.each(terminalExercises)("$id: the reference solution runs without an unknown-command/runtime error", (exercise) => {
    const context = buildContext(exercise);
    let stderr = "";
    expect(() => {
      stderr = executeShellInput(exercise.referenceSolution ?? "", context).stderr;
    }).not.toThrow();
    expectNoEngineError(stderr);
  });
});

describe("git exercises", () => {
  const gitExercises = exercises.filter((exercise) => exercise.type === "git");

  it("Ch19 has git exercises", () => {
    expect(gitExercises.filter((exercise) => exercise.chapterId === "ch19").length).toBeGreaterThan(0);
  });

  it.each(gitExercises)("$id: initialCwd is a valid directory in its VFS snapshot", (exercise) => {
    const cwd = exercise.initialCwd ?? HOME_DIR;
    const snapshot = getVfsSnapshot(exercise.chapterId, exercise.vfsSnapshotId);
    const vfs = new VirtualFileSystem(snapshot, STUDY_USER);
    expect(vfs.stat(cwd).type).toBe("directory");
  });

  it.each(gitExercises)("$id: has a referenceSolution", (exercise) => {
    expect(exercise.referenceSolution).toBeTruthy();
  });

  it.each(gitExercises)("$id: the reference solution runs without an unknown-command/runtime error", (exercise) => {
    const context = buildContext(exercise);
    let stderr = "";
    expect(() => {
      stderr = executeShellInput(exercise.referenceSolution ?? "", context).stderr;
    }).not.toThrow();
    expectNoEngineError(stderr);
  });
});

describe("script exercises", () => {
  const scriptExercises = exercises.filter((exercise) => exercise.type === "script");

  it.each(scriptExercises)("$id: has a referenceSolution and at least one test case", (exercise) => {
    expect(exercise.referenceSolution).toBeTruthy();
    expect(exercise.testCases?.length ?? 0).toBeGreaterThan(0);
  });

  for (const exercise of scriptExercises) {
    for (const testCase of exercise.testCases ?? []) {
      it(`${exercise.id} / ${testCase.id}: the reference solution runs cleanly`, () => {
        const context = buildContext(exercise);
        context.stdin = testCase.stdin ?? "";
        let stderr = "";
        expect(() => {
          stderr = executeShellInput(exercise.referenceSolution ?? "", context, testCase.args ?? []).stderr;
        }).not.toThrow();
        expectNoEngineError(stderr);
      });
    }
  }
});

describe("quiz exercises", () => {
  const quizExercises = exercises.filter((exercise) => exercise.type === "quiz");

  it("Ch2-3 has quiz exercises", () => {
    expect(quizExercises.filter((exercise) => exercise.chapterId === "ch02-03").length).toBeGreaterThan(0);
  });

  it("Ch1 has quiz exercises", () => {
    expect(quizExercises.filter((exercise) => exercise.chapterId === "ch01").length).toBeGreaterThan(0);
  });

  it.each(quizExercises)("$id: correctChoiceIndex points at an actual choice", (exercise) => {
    expect(exercise.choices?.length ?? 0).toBeGreaterThan(1);
    expect(exercise.correctChoiceIndex).toBeGreaterThanOrEqual(0);
    expect(exercise.correctChoiceIndex).toBeLessThan(exercise.choices?.length ?? 0);
  });

  it.each(quizExercises)("$id: choices are unique", (exercise) => {
    expect(new Set(exercise.choices).size).toBe(exercise.choices?.length ?? 0);
  });
});

describe("vim exercises", () => {
  const vimExercises = exercises.filter((exercise) => exercise.type === "vim");

  it("Ch7 has vim exercises", () => {
    expect(vimExercises.filter((exercise) => exercise.chapterId === "ch07").length).toBeGreaterThan(0);
  });

  it.each(vimExercises)("$id: has initialFileText and expectedFileText", (exercise) => {
    expect(exercise.initialFileText).toBeTruthy();
    expect(exercise.expectedFileText).toBeTruthy();
  });

  it.each(vimExercises)("$id: expectedFileText differs from initialFileText", (exercise) => {
    expect(exercise.expectedFileText).not.toBe(exercise.initialFileText);
  });

  /**
   * referenceSolution(表示用のキー入力列)を実際のVimエンジンに1キーずつ再生し、
   * expectedFileText と一致するかを検証する。`<Esc>` はEscapeキー、`:`で始まる場合は
   * 末尾に暗黙のEnter(exコマンドの確定)を1つ補う、という表示上の省略規則をここでのみ展開する。
   */
  function toVimKeys(referenceSolution: string): VimKey[] {
    const keys: VimKey[] = [];
    let i = 0;
    while (i < referenceSolution.length) {
      if (referenceSolution.startsWith("<Esc>", i)) {
        keys.push("Escape");
        i += "<Esc>".length;
      } else {
        keys.push(referenceSolution[i]);
        i += 1;
      }
    }
    if (referenceSolution.startsWith(":")) keys.push("Enter");
    return keys;
  }

  it.each(vimExercises.filter((exercise) => exercise.referenceSolution))(
    "$id: referenceSolution replayed on initialFileText produces expectedFileText",
    (exercise) => {
      let state = createInitialState(exercise.initialFileText ?? "");
      for (const key of toVimKeys(exercise.referenceSolution ?? "")) {
        state = applyKey(state, key);
      }
      expect(bufferToFileText(state.buffer)).toBe(exercise.expectedFileText);
    },
  );
});
