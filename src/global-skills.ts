import { realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import type { Skill } from "@earendil-works/pi-coding-agent";
import type { ServerConfig } from "./config.js";
import { isPathInsideRoot } from "./roots.js";
import { loadWorkspaceSkills, type LoadedSkills } from "./skills.js";

/**
 * Load only the user-global skill catalog.
 *
 * Using the home directory as cwd deliberately makes the existing
 * project `.agents/skills` candidate collapse to `~/.agents/skills`, while
 * preserving the existing global DevSpace, Codex/agent-dir, bundled, and
 * DEVSPACE_SKILL_PATHS behavior.
 */
export function loadGlobalSkills(config: ServerConfig): LoadedSkills {
  return loadWorkspaceSkills(config, homedir());
}

export function normalizeSkillSelector(selector: string): string {
  const trimmed = selector.trim();
  return (trimmed.startsWith("$") ? trimmed.slice(1) : trimmed).trim();
}

export function findGlobalSkill(
  skills: readonly Skill[],
  selector: string,
): Skill | undefined {
  const name = normalizeSkillSelector(selector);
  if (!name) return undefined;

  return (
    skills.find((skill) => skill.name === name) ??
    skills.find((skill) => skill.name.toLowerCase() === name.toLowerCase())
  );
}

export function filterGlobalSkills(
  skills: readonly Skill[],
  query?: string,
): Skill[] {
  const normalized = query ? normalizeSkillSelector(query).toLowerCase() : "";

  return skills
    .map((skill) => ({
      skill,
      rank: skillMatchRank(skill, normalized),
    }))
    .filter(
      (entry): entry is { skill: Skill; rank: number } =>
        entry.rank !== undefined,
    )
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.skill.name.localeCompare(b.skill.name, undefined, {
          sensitivity: "base",
        }),
    )
    .map((entry) => entry.skill);
}

export function resolveGlobalSkillReadPath(
  skill: Skill,
  relativePath?: string,
): string {
  const requestedPath = !relativePath?.trim()
    ? resolve(skill.filePath)
    : resolve(skill.baseDir, relativePath);
  if (relativePath && isAbsolute(relativePath)) {
    throw new Error("Skill resource path must be relative to the selected skill.");
  }

  const declaredBaseDir = resolve(skill.baseDir);
  if (!isPathInsideRoot(requestedPath, declaredBaseDir)) {
    throw new Error("Skill resource path is outside the selected skill directory.");
  }

  const baseDir = realpathSync(declaredBaseDir);
  const absolutePath = realpathSync(requestedPath);
  if (!isPathInsideRoot(absolutePath, baseDir)) {
    throw new Error("Skill resource path is outside the selected skill directory.");
  }
  return absolutePath;
}

function skillMatchRank(skill: Skill, query: string): number | undefined {
  if (!query) return 4;
  const name = skill.name.toLowerCase();
  const description = skill.description.toLowerCase();
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (name.includes(query)) return 2;
  if (description.includes(query)) return 3;
  return undefined;
}
