import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("quality gate configuration", () => {
  test("root package scripts define a reusable local quality gate", () => {
    const packageJson = JSON.parse(readRepoFile("package.json"));
    const scripts = packageJson.scripts ?? {};

    expect(scripts.lint).toContain("bunx @biomejs/biome check .");
    expect(scripts.lint).toContain("bun run --if-present --workspaces lint");
    expect(scripts.typecheck).toBe("bun run --workspaces typecheck");
    expect(scripts.test).toBe(
      "bun test && bun run --workspaces test --if-present",
    );
    expect(scripts.build).toBe("bun run --workspaces build");
    expect(scripts.check).toBe(
      "bun run lint && bun run typecheck && bun run test && bun run build",
    );
  });

  test("readme documents the one-shot quality gate command", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain("bun run check");
    expect(readme).toContain("bun run lint");
    expect(readme).toContain("bun run typecheck");
    expect(readme).toContain("bun run test");
    expect(readme).toContain("bun run build");
  });

  test("github actions workflow runs the quality gate on all target operating systems", () => {
    const workflow = readRepoFile(".github/workflows/ci.yml");

    expect(workflow).toContain("name: CI");
    expect(workflow).toContain("ubuntu-latest");
    expect(workflow).toContain("macos-latest");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("oven-sh/setup-bun");
    expect(workflow).toContain("bun install --frozen-lockfile");
    expect(workflow).toContain("bun run lint");
    expect(workflow).toContain("bun run typecheck");
    expect(workflow).toContain("bun run test");
    expect(workflow).toContain("bun run build");
  });

  test("repository normalizes text files to LF for cross-platform formatting", () => {
    const gitattributes = readRepoFile(".gitattributes");

    expect(gitattributes).toContain("* text=auto eol=lf");
    expect(gitattributes).toContain("*.sh text eol=lf");
    expect(gitattributes).toContain("*.yml text eol=lf");
  });
});
