import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();

function readRepoFile(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

describe("runtime docker deploy MVP", () => {
  test("defines Docker runtime assets and package scripts", () => {
    expect(existsSync(join(repoRoot, "Dockerfile.runtime"))).toBe(true);
    expect(existsSync(join(repoRoot, ".dockerignore"))).toBe(true);
    expect(
      existsSync(join(repoRoot, "scripts/docker-runtime-entrypoint.sh")),
    ).toBe(true);
    expect(existsSync(join(repoRoot, "scripts/docker-runtime-smoke.sh"))).toBe(
      true,
    );

    const packageJson = JSON.parse(readRepoFile("package.json"));

    expect(packageJson.scripts["docker:build:runtime"]).toBe(
      "docker build -f Dockerfile.runtime -t agentsuit/runtime:latest .",
    );
    expect(packageJson.scripts["docker:smoke:runtime"]).toBe(
      "bash scripts/docker-runtime-smoke.sh",
    );
  });

  test("documents the canonical docker build and runtime contract", () => {
    const readme = readRepoFile("README.md");

    expect(readme).toContain(
      "docker build -f Dockerfile.runtime -t agentsuit/runtime:latest .",
    );
    expect(readme).toContain("docker run --rm -p 8080:8080");
    expect(readme).toContain(
      "-v $PWD/examples/suits/minimal-starter:/app/suit:ro",
    );
    expect(readme).toContain("-v agentsuit-state:/app/state");
    expect(readme).toContain("-v agentsuit-reports:/app/reports");
    expect(readme).toContain(
      "docker run --rm agentsuit/runtime:latest inspect /app/suit",
    );
  });

  test("provides a smoke verification workflow for success and failure paths", () => {
    const smokeScript = readRepoFile("scripts/docker-runtime-smoke.sh");
    const entrypointScript = readRepoFile(
      "scripts/docker-runtime-entrypoint.sh",
    );
    const dockerfile = readRepoFile("Dockerfile.runtime");

    expect(smokeScript).toContain("docker build -f Dockerfile.runtime");
    expect(smokeScript).toContain("/healthz");
    expect(smokeScript).toContain(
      "examples/suits/minimal-starter:/app/suit:ro",
    );
    expect(smokeScript).toContain(
      "examples/suits/missing-overlay:/app/suit:ro",
    );
    expect(entrypointScript).toContain("/app/suit/suit.yaml");
    expect(entrypointScript).toContain("mkdir -p /app/state /app/reports");
    expect(dockerfile).toContain(
      'CMD ["serve", "/app/suit", "--host", "0.0.0.0", "--port", "8080"]',
    );
    expect(dockerfile).toContain("HEALTHCHECK");
  });
});
