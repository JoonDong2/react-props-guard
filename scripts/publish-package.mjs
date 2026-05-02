#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const INITIAL_VERSION = '0.1.0';
const PACKAGE_NAME = 'react-props-guard';
const ALL_ZERO_SHA = /^0+$/;

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');

const options = parseArgs(process.argv.slice(2));

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function main() {
  const head = resolveHead(options.head ?? process.env.GITHUB_SHA ?? 'HEAD');
  options.resolvedHead = head;
  const base = resolveBase(options.base ?? process.env.GITHUB_EVENT_BEFORE, head);
  const changedFiles = getChangedFiles(base, head);

  log(`Base: ${base}`);
  log(`Head: ${head}`);
  log(`Changed files: ${changedFiles.length}`);

  if (!hasPublishableChanges(changedFiles)) {
    log('No publishable package changes detected.');
    return;
  }

  if (!options.dryRun && !process.env.NODE_AUTH_TOKEN) {
    throw new Error('NODE_AUTH_TOKEN is required to publish packages.');
  }

  const result = publishPackage();
  commitVersionBump();

  log('Publish results:');
  log(`- ${result.name}@${result.version}${result.skipped ? ' (already published)' : ''}`);
}

function publishPackage() {
  const packageJson = readPackageJson();
  const currentVersion = packageJson.version;
  const publishedInfo = getPublishedPackageInfo(PACKAGE_NAME);

  if (publishedInfo?.gitHead === options.resolvedHead) {
    log(
      `${PACKAGE_NAME}: ${publishedInfo.version} is already published for ${options.resolvedHead}; ensuring tag only`
    );
    createPackageTag(PACKAGE_NAME, publishedInfo.version);
    return {
      name: PACKAGE_NAME,
      version: publishedInfo.version,
      skipped: true,
    };
  }

  const nextVersion = publishedInfo
    ? incrementPatch(maxVersion(currentVersion, publishedInfo.version))
    : currentVersion || INITIAL_VERSION;

  log(
    publishedInfo
      ? `${PACKAGE_NAME}: npm latest is ${publishedInfo.version}; publishing ${nextVersion}`
      : `${PACKAGE_NAME}: not found on npm; publishing ${nextVersion}`
  );

  if (currentVersion !== nextVersion) {
    if (options.dryRun) {
      log(`[dry-run] set ${PACKAGE_NAME} version ${currentVersion} -> ${nextVersion}`);
    } else {
      packageJson.version = nextVersion;
      writePackageJson(packageJson);
    }
  }

  if (options.dryRun) {
    log('[dry-run] npm publish --provenance --access public');
  } else {
    run('npm', ['publish', '--provenance', '--access', 'public'], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_AUTH_TOKEN: process.env.NODE_AUTH_TOKEN,
      },
    });
  }

  createPackageTag(PACKAGE_NAME, nextVersion);

  return {
    name: PACKAGE_NAME,
    version: nextVersion,
    skipped: false,
  };
}

function hasPublishableChanges(changedFiles) {
  return changedFiles.some((file) => {
    if (
      file === 'package.json' ||
      file === 'README.md' ||
      file === 'LICENSE' ||
      file === 'yarn.lock' ||
      file.startsWith('src/') ||
      file.startsWith('scripts/') ||
      file.startsWith('tsconfig')
    ) {
      return true;
    }

    return false;
  });
}

function createPackageTag(packageName, version) {
  const tagName = `${packageName}@${version}`;
  if (options.dryRun) {
    log(`[dry-run] git tag -a ${tagName} -m ${tagName}`);
    return;
  }

  if (gitRefExists(`refs/tags/${tagName}`)) {
    log(`Tag already exists: ${tagName}`);
    return;
  }

  run('git', ['tag', '-a', tagName, '-m', tagName]);
}

function commitVersionBump() {
  if (options.dryRun) {
    log('[dry-run] skip release commit');
    return;
  }

  if (!hasWorktreeChanges('package.json')) {
    log('No version bump commit needed.');
    return;
  }

  run('git', ['add', 'package.json']);
  if (commandSucceeds('git', ['diff', '--cached', '--quiet'])) {
    log('No staged version bump changes.');
    return;
  }

  run('git', [
    'commit',
    '-m',
    'chore(release): publish package [skip ci]',
  ]);
}

function getChangedFiles(base, head) {
  const output = run('git', ['diff', '--name-only', base, head]);
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getPublishedPackageInfo(packageName) {
  if (options.dryRun) {
    if (options.assumePublishedCurrent) {
      return {
        version: readPackageJson().version,
        gitHead: options.resolvedHead,
      };
    }
    if (options.assumePublished) {
      return {
        version: readPackageJson().version,
        gitHead: 'previous-published-commit',
      };
    }
    return undefined;
  }

  try {
    const output = run('npm', ['view', packageName, 'version', 'gitHead', '--json'], {
      stdio: 'pipe',
    });
    const value = JSON.parse(output.trim());
    if (typeof value === 'string') {
      return {
        version: value,
        gitHead: undefined,
      };
    }
    if (value && typeof value.version === 'string') {
      return {
        version: value.version,
        gitHead: typeof value.gitHead === 'string' ? value.gitHead : undefined,
      };
    }
    return undefined;
  } catch (error) {
    const text = [
      error.stdout?.toString('utf8'),
      error.stderr?.toString('utf8'),
      error.message,
    ]
      .filter(Boolean)
      .join('\n');
    if (text.includes('E404') || text.includes('404 Not Found')) {
      return undefined;
    }
    throw error;
  }
}

function resolveBase(base, head) {
  if (!base || ALL_ZERO_SHA.test(base)) {
    const parent = `${head}^`;
    return commandSucceeds('git', ['rev-parse', '--verify', parent]) ? parent : head;
  }

  return resolveHead(base);
}

function resolveHead(ref) {
  return run('git', ['rev-parse', ref]).trim();
}

function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
}

function writePackageJson(packageJson) {
  writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function hasWorktreeChanges(file) {
  return !commandSucceeds('git', ['diff', '--quiet', '--', file]);
}

function gitRefExists(ref) {
  return commandSucceeds('git', ['show-ref', '--verify', '--quiet', ref]);
}

function maxVersion(left, right) {
  return compareVersions(left, right) >= 0 ? left : right;
}

function incrementPatch(version) {
  const parsed = parseVersion(version);
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
}

function compareVersions(left, right) {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  for (const key of ['major', 'minor', 'patch']) {
    if (parsedLeft[key] !== parsedRight[key]) {
      return parsedLeft[key] - parsedRight[key];
    }
  }
  return 0;
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-.+)?$/);
  if (!match) {
    throw new Error(`Unsupported semver version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function parseArgs(args) {
  const parsed = {
    dryRun: false,
    assumePublished: false,
    assumePublishedCurrent: false,
    base: undefined,
    head: undefined,
    resolvedHead: undefined,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--dry-run') {
      parsed.dryRun = true;
    } else if (arg === '--assume-published') {
      parsed.assumePublished = true;
    } else if (arg === '--assume-published-current') {
      parsed.assumePublishedCurrent = true;
    } else if (arg === '--base') {
      parsed.base = args[index + 1];
      index += 1;
    } else if (arg === '--head') {
      parsed.head = args[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
}

function commandSucceeds(command, args) {
  try {
    run(command, args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    encoding: options.encoding ?? 'utf8',
    stdio: options.stdio ?? 'pipe',
  });
}

function log(message) {
  console.log(message);
}
