import { parseArgs } from "./args";
import { fail, ok } from "./errors";
import type { CommandContext, CommandHandler, MockProcess } from "./types";

function ownedProcesses(context: CommandContext): MockProcess[] {
  const owner = context.vfs.getUser().name;
  return context.processes.filter((process) => process.owner === owner);
}

function ownedJobs(context: CommandContext): MockProcess[] {
  return ownedProcesses(context)
    .filter((process) => process.jobId !== undefined)
    .sort((a, b) => (a.jobId ?? 0) - (b.jobId ?? 0));
}

/** `%2` のようなジョブ指定、または省略時(最も番号の大きいカレントジョブ)を解決する。 */
function findJob(context: CommandContext, spec: string | undefined): MockProcess | undefined {
  const jobs = ownedJobs(context);
  if (!spec) return jobs[jobs.length - 1];
  if (!spec.startsWith("%")) return undefined;
  const jobId = Number(spec.slice(1));
  return jobs.find((job) => job.jobId === jobId);
}

/**
 * ps(1)を模した一覧表示。`-e`/`-a`/`-A`(全ユーザー分表示)以外は
 * 現在のユーザーが所有するプロセスのみを表示する(実際のps同様、端末/ユーザーで絞り込む挙動)。
 */
export const psCommand: CommandHandler = (args, context) => {
  const { flags } = parseArgs(args);
  const showAll = flags.has("e") || flags.has("a") || flags.has("A");
  const processes = showAll ? context.processes : ownedProcesses(context);

  const rows = processes.map((process) => {
    const stat = process.status === "running" ? "R" : "T";
    return `${String(process.pid).padStart(6)} ${stat} ${process.command}`;
  });

  return ok(`${["   PID S CMD", ...rows].join("\n")}\n`);
};

/** jobs(1)を模した出力。カレントジョブ(番号が最大のもの)には`+`を付ける。 */
export const jobsCommand: CommandHandler = (_args, context) => {
  const jobs = ownedJobs(context);
  if (jobs.length === 0) return ok("");

  const currentJobId = jobs[jobs.length - 1].jobId;
  const lines = jobs.map((job) => {
    const marker = job.jobId === currentJobId ? "+" : "-";
    const status = job.status === "running" ? "Running" : "Stopped";
    const suffix = job.status === "running" ? " &" : "";
    return `[${job.jobId}]${marker}  ${status.padEnd(22)} ${job.command}${suffix}`;
  });

  return ok(`${lines.join("\n")}\n`);
};

/** バックグラウンド/停止中のジョブをフォアグラウンドへ持ってくる。以後`jobs`には表示されなくなる。 */
export const fgCommand: CommandHandler = (args, context) => {
  const spec = args[0];
  const job = findJob(context, spec);
  if (!job) return fail(`fg: ${spec ?? "current"}: no such job`);

  job.status = "running";
  delete job.jobId;
  return ok(`${job.command}\n`);
};

/** 停止中のジョブをバックグラウンドで再開する。 */
export const bgCommand: CommandHandler = (args, context) => {
  const spec = args[0];
  const job = findJob(context, spec);
  if (!job) return fail(`bg: ${spec ?? "current"}: no such job`);
  if (job.status === "running") return fail(`bg: job already in background`);

  job.status = "running";
  return ok(`[${job.jobId}]+ ${job.command} &\n`);
};

/**
 * kill(1)を模した終了処理。PID(数値)または`%N`(ジョブ番号)を受け付ける。
 * シグナル指定(`-9`, `-SIGTERM`, `-s TERM`等)は解析するが、本シミュレータでは
 * シグナルの種類にかかわらず対象プロセスを一覧から取り除くことで終了を表現する。
 * root以外のユーザーは自分が所有するプロセスしか終了できない(Ch9の権限概念と接続)。
 */
export const killCommand: CommandHandler = (args, context) => {
  const targets = args.filter((arg) => !arg.startsWith("-"));
  if (targets.length === 0) return fail("kill: usage: kill [-signal] pid | %jobid ...");

  const user = context.vfs.getUser();
  const errors: string[] = [];

  for (const target of targets) {
    if (target.startsWith("%")) {
      const jobId = Number(target.slice(1));
      const job = ownedJobs(context).find((candidate) => candidate.jobId === jobId);
      if (!job) {
        errors.push(`bash: kill: ${target}: no such job`);
        continue;
      }
      context.processes.splice(context.processes.indexOf(job), 1);
      continue;
    }

    const pid = Number(target);
    if (!Number.isInteger(pid)) {
      errors.push(`kill: ${target}: arguments must be process or job IDs`);
      continue;
    }
    const process = context.processes.find((candidate) => candidate.pid === pid);
    if (!process) {
      errors.push(`kill: (${pid}): No such process`);
      continue;
    }
    if (!user.isRoot && process.owner !== user.name) {
      errors.push(`kill: (${pid}): Operation not permitted`);
      continue;
    }
    context.processes.splice(context.processes.indexOf(process), 1);
  }

  return errors.length > 0 ? fail(errors.join("\n")) : ok("");
};
