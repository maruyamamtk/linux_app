import { describe, expect, it } from "vitest";

import { findRemoteHost } from "./hosts";

describe("findRemoteHost", () => {
  it("finds the registered webserver host", () => {
    const host = findRemoteHost("webserver");
    expect(host?.promptHost).toBe("webserver");
    expect(host?.homeDir).toBe("/home/study");
  });

  it("returns undefined for an unregistered host", () => {
    expect(findRemoteHost("no-such-host")).toBeUndefined();
  });
});
