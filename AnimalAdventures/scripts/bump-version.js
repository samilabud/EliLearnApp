#!/usr/bin/env node

/*
  Bump app versions for Android + Expo config.

  Usage examples:
    - Patch bump (default):        node scripts/bump-version.js
    - Minor bump:                  node scripts/bump-version.js --type minor
    - Major bump:                  node scripts/bump-version.js --type major
    - Set exact version:           node scripts/bump-version.js --set 4.2.0
    - Explicit Android versionCode node scripts/bump-version.js --code 12
    - Android only:                node scripts/bump-version.js --android-only
    - iOS only (Expo config only): node scripts/bump-version.js --ios-only
    - Dry run (no writes):         node scripts/bump-version.js --dry-run

  Notes:
    - Source of truth for semantic version is package.json:version.
    - Updates:
        package.json: version
        app.json: expo.version, ios.buildNumber (string), android.versionCode (int)
        android/app/build.gradle: versionName (string), versionCode (int)
    - iOS native Info.plist is not modified by default.
*/

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const appJsonPath = path.join(rootDir, 'app.json');
const androidGradlePath = path.join(rootDir, 'android', 'app', 'build.gradle');

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

function getAndroidVersionCodeFromGradle(gradleContent) {
  const m = gradleContent.match(/versionCode\s+(\d+)/);
  return m ? Number(m[1]) : null;
}

function updateGradleVersion(gradleContent, { versionName, versionCode }) {
  let updated = gradleContent;
  if (versionCode != null) {
    updated = updated.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  }
  if (versionName) {
    updated = updated.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
  }
  return updated;
}

function main() {
  const args = parseArgs(process.argv);

  if (args.androidOnly && args.iosOnly) {
    throw new Error('Use only one of --android-only or --ios-only');
  }

  const pkg = readJson(packageJsonPath);
  const app = readJson(appJsonPath);
  const gradle = readText(androidGradlePath);

  const currentSemver = pkg.version;
  const nextSemver = args.set ? args.set : bumpSemver(currentSemver, args.type);

  const currentAndroidCode = getAndroidVersionCodeFromGradle(gradle) ?? app?.expo?.android?.versionCode ?? 1;
  const nextAndroidCode = args.code != null ? Number(args.code) : Number(currentAndroidCode) + 1;

  const changes = [];

  if (!args.iosOnly) {
    // Update Android Gradle
    const nextGradle = updateGradleVersion(gradle, { versionName: nextSemver, versionCode: nextAndroidCode });
    if (nextGradle !== gradle) {
      changes.push({ file: androidGradlePath, description: `versionName ${currentSemver} -> ${nextSemver}, versionCode ${currentAndroidCode} -> ${nextAndroidCode}` });
      if (!args.dryRun) writeText(androidGradlePath, nextGradle);
    }
  }

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
    // ios.buildNumber (string)
    if (!args.androidOnly && app.expo.ios && app.expo.ios.buildNumber !== nextSemver) {
      const prev = app.expo.ios.buildNumber;
      app.expo.ios.buildNumber = nextSemver;
      appChanged = true;
      changes.push({ file: appJsonPath, description: `ios.buildNumber ${prev} -> ${nextSemver}` });
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


