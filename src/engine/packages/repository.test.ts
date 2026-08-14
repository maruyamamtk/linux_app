import { describe, expect, it } from "vitest";

import { findPackage, searchPackages } from "./repository";

describe("findPackage", () => {
  it("returns the package definition for a known name", () => {
    const pkg = findPackage("curl");
    expect(pkg).toMatchObject({ name: "curl", version: "8.4.0", dependencies: ["libcurl4"] });
  });

  it("returns undefined for an unknown name", () => {
    expect(findPackage("no-such-package")).toBeUndefined();
  });
});

describe("searchPackages", () => {
  it("matches by name, case-insensitively", () => {
    const results = searchPackages(["NGINX"]);
    expect(results.map((pkg) => pkg.name)).toEqual(["nginx"]);
  });

  it("matches by summary text", () => {
    const results = searchPackages(["JSON"]);
    expect(results.map((pkg) => pkg.name)).toEqual(["jq"]);
  });

  it("requires every given term to match (AND semantics)", () => {
    const results = searchPackages(["python3", "標準"]);
    expect(results.map((pkg) => pkg.name)).toEqual(["python3-libs"]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchPackages(["no-such-keyword"])).toEqual([]);
  });

  it("returns results sorted by name", () => {
    const results = searchPackages(["my"]);
    const names = results.map((pkg) => pkg.name);
    expect(names).toEqual([...names].sort());
  });
});
