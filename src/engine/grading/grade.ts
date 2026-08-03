import type { CommandContext, MockProcess } from "../commands";
import { executeShellInput } from "../interpreter";
import { diffTree, VirtualFileSystem, type VfsDiffEntry } from "../vfs";
import { compareText } from "./textComparison";
import type { GradeInput, GradeResult } from "./types";

function cloneProcesses(processes: MockProcess[] | undefined): MockProcess[] {
  return (processes ?? []).map((process) => ({ ...process }));
}

/** 学習者/模範解答それぞれに独立した `VirtualFileSystem` を持たせるため、実行のたびに新規構築する。 */
function buildContext(input: GradeInput): CommandContext {
  return {
    vfs: new VirtualFileSystem(input.snapshot, input.user),
    cwd: input.cwd,
    env: { ...input.env },
    processes: cloneProcesses(input.processes),
  };
}

function isIgnoredPath(path: string, ignoredPaths: string[]): boolean {
  return ignoredPaths.some((ignored) => path === ignored || path.startsWith(`${ignored}/`));
}

/**
 * 学習者の入力コマンド/スクリプトと模範解答を、同一の初期VFSスナップショットの
 * 複製に対してそれぞれ独立に実行し、標準出力/標準エラー出力/終了ステータス/
 * 実行後のVFS状態を突き合わせて正誤判定する採点エンジンの本体。
 *
 * 「文字列完全一致」ではなく実行結果(観測可能な効果)の一致を見るため、模範解答とは
 * 異なる書き方のコマンド(別解)であっても、同じ効果を持つ限り正解として扱える。
 */
export function gradeExercise(input: GradeInput): GradeResult {
  const options = input.options ?? {};
  const stdoutMode = options.stdoutMode ?? "trimTrailingNewline";
  const stderrMode = options.stderrMode ?? "trimTrailingNewline";
  const compareExitCode = options.compareExitCode ?? true;
  const compareVfs = options.compareVfs ?? true;

  const userContext = buildContext(input);
  const referenceContext = buildContext(input);

  const userResult = executeShellInput(input.userInput, userContext);
  const referenceResult = executeShellInput(input.referenceSolution, referenceContext);

  const stdout = compareText(referenceResult.stdout, userResult.stdout, stdoutMode);
  const stderr = compareText(referenceResult.stderr, userResult.stderr, stderrMode);
  const exitCode = {
    match: !compareExitCode || referenceResult.exitCode === userResult.exitCode,
    expected: referenceResult.exitCode,
    actual: userResult.exitCode,
  };

  let vfsMismatches: VfsDiffEntry[] = [];
  if (compareVfs) {
    const ignoredPaths = options.ignoreVfsPaths ?? [];
    vfsMismatches = diffTree(referenceContext.vfs.getRootNode(), userContext.vfs.getRootNode()).filter(
      (entry) => !isIgnoredPath(entry.path, ignoredPaths),
    );
  }

  const passed = stdout.match && stderr.match && exitCode.match && vfsMismatches.length === 0;

  return { passed, userResult, referenceResult, stdout, stderr, exitCode, vfsMismatches };
}
