import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import yaml from "js-yaml";

describe("Monorepo Foundation", () => {
  const root = process.cwd();

  it("should have a pnpm-workspace.yaml with correct packages", () => {
    const workspacePath = join(root, "pnpm-workspace.yaml");
    expect(existsSync(workspacePath)).toBe(true);

    const content = readFileSync(workspacePath, "utf8");
    const config = yaml.load(content) as { packages: string[] };

    expect(config.packages).toContain("apps/*");
    expect(config.packages).toContain("packages/*");
  });

  it("should have a root package.json with workspace scripts", () => {
    const pkgPath = join(root, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    expect(pkg.private).toBe(true);
    expect(pkg.scripts).toHaveProperty("test:workspace");
    expect(pkg.scripts).toHaveProperty("build:workspace");
    expect(pkg.scripts).toHaveProperty("lint:workspace");
  });

  it("should follow the planned directory structure", () => {
    // This expects the folders to exist.
    // If Issue #2 hasn't created them yet, this should fail.
    expect(existsSync(join(root, "apps"))).toBe(true);
    expect(existsSync(join(root, "packages"))).toBe(true);
  });
});
