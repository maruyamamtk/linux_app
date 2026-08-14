import { describe, expect, it } from "vitest";

import { planInstall } from "./resolve";

describe("planInstall", () => {
  it("pulls in dependencies that are not yet installed", () => {
    const plan = planInstall(["curl"], new Set());
    expect(plan.missing).toEqual([]);
    expect(plan.alreadyInstalled).toEqual([]);
    expect(plan.requested.map((pkg) => pkg.name)).toEqual(["curl"]);
    expect(plan.dependencies.map((pkg) => pkg.name)).toEqual(["libcurl4"]);
  });

  it("does not re-pull a dependency that is already installed", () => {
    const plan = planInstall(["curl"], new Set(["libcurl4"]));
    expect(plan.requested.map((pkg) => pkg.name)).toEqual(["curl"]);
    expect(plan.dependencies).toEqual([]);
  });

  it("reports unknown package names as missing without touching the rest of the plan", () => {
    const plan = planInstall(["curl", "no-such-package"], new Set());
    expect(plan.missing).toEqual(["no-such-package"]);
    expect(plan.requested.map((pkg) => pkg.name)).toEqual(["curl"]);
  });

  it("reports already-installed requested packages separately, without duplicating dependencies", () => {
    const plan = planInstall(["curl"], new Set(["curl", "libcurl4"]));
    expect(plan.alreadyInstalled).toEqual(["curl"]);
    expect(plan.requested).toEqual([]);
    expect(plan.dependencies).toEqual([]);
  });

  it("does not list a dependency twice when it is also requested explicitly afterwards", () => {
    const plan = planInstall(["mysql-server", "mysql-common"], new Set());
    expect(plan.requested.map((pkg) => pkg.name)).toEqual(["mysql-server"]);
    expect(plan.dependencies.map((pkg) => pkg.name)).toEqual(["mysql-common"]);
  });

  it("ignores a duplicate name given twice in the same request", () => {
    const plan = planInstall(["curl", "curl"], new Set());
    expect(plan.requested.map((pkg) => pkg.name)).toEqual(["curl"]);
    expect(plan.dependencies.map((pkg) => pkg.name)).toEqual(["libcurl4"]);
  });
});
