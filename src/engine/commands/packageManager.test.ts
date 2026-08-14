import { describe, expect, it } from "vitest";

import { aptCommand, dnfCommand } from "./packageManager";
import { sudoCommand } from "./permissions";
import { ROOT_USER, buildContext } from "./testFixtures";

describe("dnf search", () => {
  it("lists packages whose name or summary matches the keyword", () => {
    const result = dnfCommand(["search", "curl"], buildContext());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("curl.x86_64 : ");
  });

  it("reports no matches without failing", () => {
    const result = dnfCommand(["search", "no-such-keyword"], buildContext());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("No matches found.\n");
  });

  it("fails when no keyword is given", () => {
    const result = dnfCommand(["search"], buildContext());
    expect(result.exitCode).not.toBe(0);
  });
});

describe("dnf info", () => {
  it("shows package details and 'Available Packages' before it is installed", () => {
    const result = dnfCommand(["info", "curl"], buildContext());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Available Packages");
    expect(result.stdout).toContain("Name         : curl");
    expect(result.stdout).toContain("Version      : 8.4.0");
  });

  it("fails for an unknown package", () => {
    const result = dnfCommand(["info", "no-such-package"], buildContext());
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("No matching Packages to list");
  });
});

describe("dnf install", () => {
  it("requires root privileges", () => {
    const context = buildContext();
    const result = dnfCommand(["install", "curl"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("superuser privileges");
  });

  it("installs the package and its dependencies via sudo, then info/search reflect the change", () => {
    const context = buildContext();
    const result = sudoCommand(["dnf", "install", "curl"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Installing:");
    expect(result.stdout).toContain("curl");
    expect(result.stdout).toContain("Installing dependencies:");
    expect(result.stdout).toContain("libcurl4");
    expect(result.stdout).toContain("Complete!");

    const info = dnfCommand(["info", "curl"], context);
    expect(info.stdout).toContain("Installed Packages");
  });

  it("reports an already-installed package instead of reinstalling it", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    dnfCommand(["install", "curl"], context);
    const result = dnfCommand(["install", "curl"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("is already installed");
    expect(result.stdout).toContain("Nothing to do.");
  });

  it("fails for an unknown package without installing anything", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    const result = dnfCommand(["install", "no-such-package"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unable to find a match");
    expect(dnfCommand(["info", "no-such-package"], context).exitCode).not.toBe(0);
  });
});

describe("dnf unsupported subcommand", () => {
  it("fails instead of silently ignoring it", () => {
    const result = dnfCommand(["remove", "curl"], buildContext());
    expect(result.exitCode).not.toBe(0);
  });
});

describe("apt search", () => {
  it("lists matching packages in 'name/stable version arch' form", () => {
    const result = aptCommand(["search", "nginx"], buildContext());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("nginx/stable 1.24.0 amd64");
  });

  it("prints nothing when there are no matches", () => {
    const result = aptCommand(["search", "no-such-keyword"], buildContext());
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe("");
  });
});

describe("apt info", () => {
  it("shows a Depends line only when the package has dependencies", () => {
    const withDeps = aptCommand(["info", "curl"], buildContext());
    expect(withDeps.stdout).toContain("Depends: libcurl4");

    const withoutDeps = aptCommand(["info", "nginx"], buildContext());
    expect(withoutDeps.stdout).not.toContain("Depends:");
  });

  it("fails for an unknown package", () => {
    const result = aptCommand(["info", "no-such-package"], buildContext());
    expect(result.exitCode).not.toBe(0);
  });
});

describe("apt install", () => {
  it("requires root privileges", () => {
    const result = aptCommand(["install", "nginx"], buildContext());
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("are you root?");
  });

  it("installs the package and reports additional dependencies", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    const result = aptCommand(["install", "curl"], context);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("The following additional packages will be installed:");
    expect(result.stdout).toContain("libcurl4");
    expect(result.stdout).toContain("Setting up curl (8.4.0) ...");
  });

  it("reports an already-installed package as the newest version", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    aptCommand(["install", "nginx"], context);
    const result = aptCommand(["install", "nginx"], context);
    expect(result.stdout).toContain("nginx is already the newest version (1.24.0).");
  });

  it("fails for an unknown package", () => {
    const context = buildContext(ROOT_USER, "/home/study");
    const result = aptCommand(["install", "no-such-package"], context);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unable to locate package");
  });
});
