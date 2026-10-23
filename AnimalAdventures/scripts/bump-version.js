#!/usr/bin/env node

/*
  Bump app versions in the Expo config (CNG / prebuild project).

  Usage examples:
    - Patch bump (default):        node scripts/bump-version.js
    - Minor bump:                  node scripts/bump-version.js --type minor
    - Major bump:                  node scripts/bump-version.js --type major
    - Set exact version:           node scripts/bump-version.js --set 4.2.0
    - Explicit Android versionCode node scripts/bump-version.js --code 12
    - Explicit iOS build number:   node scripts/bump-version.js --ios-code 7
    - Android only:                node scripts/bump-version.js --android-only
    - iOS only (Expo config only): node scripts/bump-version.js --ios-only
    - Dry run (no writes):         node scripts/bump-version.js --dry-run

  Notes:
    - Source of truth for semantic version is package.json:version.
    - Updates:
        package.json: version
        app.json: expo.version, ios.buildNumber (int, as string), android.versionCode (int)
    - This project uses Expo Prebuild (CNG): the android/ and ios/ folders are
      generated and gitignored, so native files are never edited here. Gradle's
      versionName/versionCode and the iOS Info.plist are derived from app.json
      by `expo prebuild`.
    - ios.buildNumber is NOT the same value as expo.version. Apple requires the
      iOS build number to strictly increase on every TestFlight/App Store
      upload, even repeat uploads of the same marketing version (e.g. a fix
      after a rejection). So ios.buildNumber is its own integer counter, bumped
      by +1 each run, the same way android.versionCode already works. Override
      with --ios-code N when needed.
*/

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const appJsonPath = path.join(rootDir, 'app.json');

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function readJson(filePath) {
  return JSON.parse(readText(filePath));
}

function writeJson(filePath, data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  writeText(filePath, content);
}

function parseArgs(argv) {
  const args = {
    type: 'patch',
    set: null,
    code: null,
    iosCode: null,
    androidOnly: false,
    iosOnly: false,
    dryRun: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--type' && argv[i + 1]) {
      args.type = argv[i + 1];
      i += 1;
    } else if (a === '--set' && argv[i + 1]) {
      args.set = argv[i + 1];
      i += 1;
    } else if (a === '--code' && argv[i + 1]) {
      args.code = Number(argv[i + 1]);
      i += 1;
    } else if (a === '--ios-code' && argv[i + 1]) {
      args.iosCode = Number(argv[i + 1]);
      i += 1;
    } else if (a === '--android-only') {
      args.androidOnly = true;
    } else if (a === '--ios-only') {
      args.iosOnly = true;
    } else if (a === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}

function parseSemver(version) {
  const match = String(version).trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) throw new Error(`Invalid semver: ${version}`);
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

function formatSemver({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpSemver(version, type) {
  const v = parseSemver(version);
  if (type === 'major') {
    v.major += 1; v.minor = 0; v.patch = 0;
  } else if (type === 'minor') {
    v.minor += 1; v.patch = 0;
  } else {
    v.patch += 1;
  }
  return formatSemver(v);
}

function main() {
  const args = parseArgs(process.argv);

  if (args.androidOnly && args.iosOnly) {
    throw new Error('Use only one of --android-only or --ios-only');
  }

  const pkg = readJson(packageJsonPath);
  const app = readJson(appJsonPath);

  const currentSemver = pkg.version;
  const nextSemver = args.set ? args.set : bumpSemver(currentSemver, args.type);

  const currentAndroidCode = app?.expo?.android?.versionCode ?? 1;
  const nextAndroidCode = args.code != null ? Number(args.code) : Number(currentAndroidCode) + 1;

  const currentIosBuildNumber = parseInt(app?.expo?.ios?.buildNumber, 10) || 0;
  const nextIosBuildNumber =
    args.iosCode != null ? Number(args.iosCode) : currentIosBuildNumber + 1;

  const changes = [];

  // Update package.json
  if (pkg.version !== nextSemver && !args.androidOnly) {
    const prev = pkg.version;
    pkg.version = nextSemver;
    changes.push({ file: packageJsonPath, description: `version ${prev} -> ${nextSemver}` });
    if (!args.dryRun) writeJson(packageJsonPath, pkg);
  }

  // Update app.json
  if (app && app.expo) {
    let appChanged = false;
    // expo.version
    if (!args.androidOnly && app.expo.version !== nextSemver) {
      const prev = app.expo.version;
      app.expo.version = nextSemver;
      appChanged = true;
      changes.push({ file: appJsonPath, description: `expo.version ${prev} -> ${nextSemver}` });
    }
    // ios.buildNumber (independent integer counter, not the semver string)
    if (!args.androidOnly) {
      if (!app.expo.ios) app.expo.ios = {};
      const nextIosBuildNumberStr = String(nextIosBuildNumber);
      if (app.expo.ios.buildNumber !== nextIosBuildNumberStr) {
        const prev = app.expo.ios.buildNumber;
        app.expo.ios.buildNumber = nextIosBuildNumberStr;
        appChanged = true;
        changes.push({
          file: appJsonPath,
          description: `ios.buildNumber ${prev} -> ${nextIosBuildNumberStr}`,
        });
      }
    }
    // android.versionCode (int)
    if (!args.iosOnly) {
      if (!app.expo.android) app.expo.android = {};
      if (app.expo.android.versionCode !== nextAndroidCode) {
        const prev = app.expo.android.versionCode;
        app.expo.android.versionCode = nextAndroidCode;
        appChanged = true;
        changes.push({ file: appJsonPath, description: `android.versionCode ${prev} -> ${nextAndroidCode}` });
      }
    }
    if (appChanged && !args.dryRun) writeJson(appJsonPath, app);
  }

  if (changes.length === 0) {
    console.log('No changes. Everything already up-to-date.');
    return;
  }

  console.log('Planned changes:');
  for (const ch of changes) {
    console.log(`- ${ch.file}: ${ch.description}`);
  }
  if (args.dryRun) {
    console.log('\nDry run complete. No files were modified.');
  } else {
    console.log('\nVersion bump complete.');
  }
}

try {
  main();
} catch (err) {
  console.error('Error:', err.message || err);
  process.exit(1);
}


