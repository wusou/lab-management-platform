import { describe, expect, it } from "vitest";
import { createKernel } from "../src/kernel.js";

describe("kernel", () => {
  it("loads plugins through manifests", async () => {
    const kernel = await createKernel();

    expect(kernel.plugins).toEqual(["hello-world", "inventory"]);
    expect(kernel.routes.map((route) => route.path)).toContain("/plugins/hello-world");
  });
});
