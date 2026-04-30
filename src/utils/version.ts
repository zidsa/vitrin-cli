export type BumpKind = 'patch' | 'minor' | 'major';

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

export function parseSemVer(input: string | undefined | null): SemVer | null {
  if (!input) return null;
  const match = String(input)
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function formatSemVer(v: SemVer): string {
  return `${v.major}.${v.minor}.${v.patch}`;
}

export function bumpSemVer(current: SemVer, kind: BumpKind): SemVer {
  switch (kind) {
    case 'major':
      return { major: current.major + 1, minor: 0, patch: 0 };
    case 'minor':
      return { major: current.major, minor: current.minor + 1, patch: 0 };
    case 'patch':
      return {
        major: current.major,
        minor: current.minor,
        patch: current.patch + 1,
      };
  }
}

export function nextVersions(current: string | undefined | null): {
  base: SemVer;
  patch: string;
  minor: string;
  major: string;
} {
  const base = parseSemVer(current) ?? { major: 1, minor: 0, patch: 0 };
  return {
    base,
    patch: formatSemVer(bumpSemVer(base, 'patch')),
    minor: formatSemVer(bumpSemVer(base, 'minor')),
    major: formatSemVer(bumpSemVer(base, 'major')),
  };
}

export function isValidSemVer(input: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(input.trim());
}
