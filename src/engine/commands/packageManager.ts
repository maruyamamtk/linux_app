import {
  findPackage,
  isPackageInstalled,
  planInstall,
  readInstalledPackages,
  recordInstalledPackages,
  searchPackages,
} from "../packages";
import type { PackageDefinition } from "../packages";
import { parseArgs } from "./args";
import { fail, ok } from "./errors";
import type { CommandContext, CommandHandler, CommandResult } from "./types";

function formatSize(sizeKb: number): string {
  return sizeKb >= 1000 ? `${(sizeKb / 1000).toFixed(1)} M` : `${sizeKb} k`;
}

/** サブコマンド以降の引数から、`-y`等のオプションを除いたパッケージ名/検索語を取り出す。 */
function targetNames(args: string[]): string[] {
  return parseArgs(args).positional;
}

function unsupportedSubcommand(tool: "dnf" | "apt", subcommand: string): CommandResult {
  return fail(`${tool}: '${subcommand}' is not a supported command in this simulator`);
}

// ---------------------------------------------------------------------------
// dnf
// ---------------------------------------------------------------------------

function formatDnfPackageRow(pkg: PackageDefinition): string {
  return ` ${pkg.name.padEnd(18)} ${pkg.version.padEnd(12)} virtual-repo   ${formatSize(pkg.sizeKb)}`;
}

function handleDnfInstall(args: string[], context: CommandContext): CommandResult {
  const names = targetNames(args);
  if (names.length === 0) return fail("Error: Need to pass a list of pkgs to install");
  if (!context.vfs.getUser().isRoot) {
    return fail(
      "Error: This command has to be run with superuser privileges (under the root user on most systems).",
    );
  }

  const installed = new Set(readInstalledPackages(context.vfs));
  const plan = planInstall(names, installed);
  if (plan.missing.length > 0) {
    return fail(plan.missing.map((name) => `Error: Unable to find a match: ${name}`).join("\n"));
  }

  if (plan.requested.length === 0) {
    const lines = plan.alreadyInstalled.map((name) => {
      const pkg = findPackage(name)!;
      return `Package ${pkg.name}-${pkg.version}.x86_64 is already installed.`;
    });
    lines.push("Dependencies resolved.", "Nothing to do.", "Complete!");
    return ok(`${lines.join("\n")}\n`);
  }

  const newPackages = [...plan.dependencies, ...plan.requested];
  recordInstalledPackages(
    context.vfs,
    newPackages.map((pkg) => pkg.name),
  );

  const divider = "=".repeat(72);
  const lines = ["Dependencies resolved.", divider, "Installing:"];
  lines.push(...plan.requested.map(formatDnfPackageRow));
  if (plan.dependencies.length > 0) {
    lines.push("Installing dependencies:");
    lines.push(...plan.dependencies.map(formatDnfPackageRow));
  }
  lines.push(
    divider,
    "",
    "Transaction Summary",
    divider,
    `Install  ${newPackages.length} Package${newPackages.length > 1 ? "s" : ""}`,
    "",
    "Complete!",
  );
  return ok(`${lines.join("\n")}\n`);
}

function handleDnfSearch(args: string[]): CommandResult {
  const terms = targetNames(args);
  if (terms.length === 0) return fail("Error: Search term is required");

  const results = searchPackages(terms);
  if (results.length === 0) return ok("No matches found.\n");

  const header = `======================== Name & Summary Matched: ${terms.join(" ")} ========================`;
  const lines = results.map((pkg) => `${pkg.name}.x86_64 : ${pkg.summary}`);
  return ok(`${[header, ...lines].join("\n")}\n`);
}

function handleDnfInfo(args: string[], context: CommandContext): CommandResult {
  const [name] = targetNames(args);
  if (!name) return fail("Error: No package specified");

  const pkg = findPackage(name);
  if (!pkg) return fail("Error: No matching Packages to list");

  const header = isPackageInstalled(context.vfs, name) ? "Installed Packages" : "Available Packages";
  const lines = [
    header,
    `Name         : ${pkg.name}`,
    `Version      : ${pkg.version}`,
    `Architecture : x86_64`,
    `Size         : ${formatSize(pkg.sizeKb)}`,
    `Source       : ${pkg.name}-${pkg.version}.src.rpm`,
    `Repository   : virtual-repo`,
    `Summary      : ${pkg.summary}`,
  ];
  return ok(`${lines.join("\n")}\n`);
}

/** `dnf <command> [<args>]`。design方針(git.ts)にならい、未対応のサブコマンドはエラーにする。 */
export const dnfCommand: CommandHandler = (args, context) => {
  const [subcommand, ...rest] = args;
  if (!subcommand) return fail("usage: dnf <command> [<args>]");

  switch (subcommand) {
    case "install":
      return handleDnfInstall(rest, context);
    case "search":
      return handleDnfSearch(rest);
    case "info":
      return handleDnfInfo(rest, context);
    default:
      return unsupportedSubcommand("dnf", subcommand);
  }
};

// ---------------------------------------------------------------------------
// apt
// ---------------------------------------------------------------------------

function handleAptInstall(args: string[], context: CommandContext): CommandResult {
  const names = targetNames(args);
  if (names.length === 0) return fail("E: Missing package name");
  if (!context.vfs.getUser().isRoot) {
    return fail(
      "E: Could not open lock file /var/lib/dpkg/lock-frontend - open (13: Permission denied)\n" +
        "E: Unable to acquire the dpkg frontend lock (/var/lib/dpkg/lock-frontend), are you root?",
    );
  }

  const installed = new Set(readInstalledPackages(context.vfs));
  const plan = planInstall(names, installed);
  if (plan.missing.length > 0) {
    return fail(plan.missing.map((name) => `E: Unable to locate package ${name}`).join("\n"));
  }

  if (plan.requested.length === 0) {
    const lines = plan.alreadyInstalled.map((name) => {
      const pkg = findPackage(name)!;
      return `${pkg.name} is already the newest version (${pkg.version}).`;
    });
    lines.push("0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.");
    return ok(`${lines.join("\n")}\n`);
  }

  const newPackages = [...plan.dependencies, ...plan.requested];
  recordInstalledPackages(
    context.vfs,
    newPackages.map((pkg) => pkg.name),
  );

  const lines = [
    "Reading package lists... Done",
    "Building dependency tree... Done",
    "Reading state information... Done",
  ];
  if (plan.dependencies.length > 0) {
    lines.push(
      "The following additional packages will be installed:",
      `  ${plan.dependencies.map((pkg) => pkg.name).join(" ")}`,
    );
  }
  lines.push(
    "The following NEW packages will be installed:",
    `  ${newPackages.map((pkg) => pkg.name).join(" ")}`,
    `0 upgraded, ${newPackages.length} newly installed, 0 to remove and 0 not upgraded.`,
  );
  lines.push(...newPackages.map((pkg) => `Setting up ${pkg.name} (${pkg.version}) ...`));
  return ok(`${lines.join("\n")}\n`);
}

function handleAptSearch(args: string[]): CommandResult {
  const terms = targetNames(args);
  if (terms.length === 0) return fail("E: You must give at least one search pattern");

  const results = searchPackages(terms);
  const lines = results.flatMap((pkg) => [`${pkg.name}/stable ${pkg.version} amd64`, `  ${pkg.summary}`]);
  return ok(lines.length > 0 ? `${lines.join("\n")}\n` : "");
}

function handleAptInfo(args: string[]): CommandResult {
  const [name] = targetNames(args);
  if (!name) return fail("E: No packages found");

  const pkg = findPackage(name);
  if (!pkg) return fail(`E: Unable to locate package ${name}`);

  const lines = [`Package: ${pkg.name}`, `Version: ${pkg.version}`, `Installed-Size: ${formatSize(pkg.sizeKb)}`];
  if (pkg.dependencies.length > 0) lines.push(`Depends: ${pkg.dependencies.join(", ")}`);
  lines.push(`Description: ${pkg.summary}`);
  return ok(`${lines.join("\n")}\n`);
}

/** `apt <command> [<args>]`。`info`は実際のaptには無いサブコマンドだが、要件に合わせdnfと揃えて用意する。 */
export const aptCommand: CommandHandler = (args, context) => {
  const [subcommand, ...rest] = args;
  if (!subcommand) return fail("usage: apt <command> [<args>]");

  switch (subcommand) {
    case "install":
      return handleAptInstall(rest, context);
    case "search":
      return handleAptSearch(rest);
    case "info":
      return handleAptInfo(rest);
    default:
      return unsupportedSubcommand("apt", subcommand);
  }
};
