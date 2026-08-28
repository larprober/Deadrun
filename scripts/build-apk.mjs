/**
 * Builds a standalone release APK locally. No Expo account, no EAS queue.
 *
 *   npm run apk
 *
 * Two things make this more than a `gradlew assembleRelease` one-liner:
 *
 * 1. OneDrive. This project lives in a synced folder, and a Gradle build writes
 *    tens of thousands of files into it. OneDrive then tries to upload all of
 *    them, and turns source files into cloud placeholders that read as empty.
 *    So the build runs against a staging copy outside the synced tree.
 * 2. Nothing here is on PATH by default — the JDK and the Android SDK get
 *    located rather than assumed, with an error that says what to install.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGE = process.env.DEADRUN_BUILD_DIR || path.join(os.homedir(), '.deadrun-build');
const WIN = process.platform === 'win32';

/** Source that goes into the staging copy. Everything else is generated. */
const COPY = [
  'App.tsx',
  'index.ts',
  'app.json',
  'eas.json',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  // Carries EXPO_PUBLIC_CARTO_KEY. Metro inlines it during the Gradle bundle
  // task, so without this the staged build silently ships watermarked tiles.
  '.env',
  'assets',
  'src',
  'scripts',
];

const step = (msg) => console.log('\n\x1b[32m>\x1b[0m ' + msg);
const die = (msg) => {
  console.error('\n\x1b[31mx\x1b[0m ' + msg + '\n');
  process.exit(1);
};

function findJdk() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const roots = WIN
    ? ['C:/Program Files/Microsoft', 'C:/Program Files/Eclipse Adoptium', 'C:/Program Files/Java']
    : ['/usr/lib/jvm', '/Library/Java/JavaVirtualMachines'];
  const found = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      const dir = path.join(root, name);
      if (fs.existsSync(path.join(dir, 'bin', WIN ? 'java.exe' : 'java'))) found.push(dir);
    }
  }
  // Gradle and AGP want 17 or newer; prefer 17 because that is what the Expo
  // template is tested against.
  found.sort((a, b) => (a.includes('17') ? -1 : b.includes('17') ? 1 : 0));
  return found[0] || null;
}

function findSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    WIN && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    WIN ? 'C:/Android/sdk' : path.join(os.homedir(), 'Android/Sdk'),
    path.join(os.homedir(), 'Library/Android/sdk'),
  ].filter(Boolean);
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'platforms'))) || null;
}

const jdk = findJdk();
if (!jdk) {
  die(
    'No JDK found. Install one, then rerun:\n' +
      '    winget install Microsoft.OpenJDK.17\n' +
      '  or set JAVA_HOME to an existing JDK 17+.'
  );
}

const sdk = findSdk();
if (!sdk) {
  die(
    'No Android SDK found. Grab the command line tools from\n' +
      '    https://developer.android.com/studio#command-line-tools-only\n' +
      '  unpack to <sdk>/cmdline-tools/latest, then:\n' +
      '    sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" \\\n' +
      '               "ndk;27.1.12297006" "cmake;3.22.1"\n' +
      '  and set ANDROID_HOME to <sdk>.'
  );
}

const env = { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk, CI: '1' };
const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, env, stdio: 'inherit', shell: WIN });

console.log('  jdk  ' + jdk);
console.log('  sdk  ' + sdk);
console.log('  out  ' + STAGE);

/* --- 1. stage a copy outside the synced folder -------------------------- */
step('staging sources');
fs.mkdirSync(STAGE, { recursive: true });
for (const name of COPY) {
  const from = path.join(ROOT, name);
  if (!fs.existsSync(from)) continue;
  const to = path.join(STAGE, name);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

// A source file that copies as zero bytes is OneDrive handing over a
// placeholder instead of the file. Better to stop than to ship a broken icon.
for (const name of ['assets/icon.png', 'src/engine.ts', 'App.tsx']) {
  const f = path.join(STAGE, name);
  if (fs.existsSync(f) && fs.statSync(f).size === 0) {
    die(
      name +
        ' copied as an empty file. OneDrive is holding it as a cloud placeholder —\n' +
        '  right-click the project folder in Explorer and choose "Always keep on this device".'
    );
  }
}

/* --- 2. dependencies ----------------------------------------------------- */
step('installing dependencies');
const lock = fs.existsSync(path.join(STAGE, 'package-lock.json'));
run('npm', [lock ? 'ci' : 'install', '--no-audit', '--no-fund'], STAGE);

/* --- 3. native project --------------------------------------------------- */
step('generating the android project');
run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], STAGE);

const androidDir = path.join(STAGE, 'android');
fs.writeFileSync(
  path.join(androidDir, 'local.properties'),
  'sdk.dir=' + sdk.replace(/\\/g, '/') + '\n'
);

/* --- 4. build ------------------------------------------------------------ */
// React Native ships a full set of native libraries per CPU architecture, and
// the default four put roughly 40 MB of emulator-only x86 code in an APK meant
// for a phone. arm64 is every phone since about 2017; armeabi-v7a covers the
// older 32-bit ones. Set DEADRUN_ABIS=arm64-v8a alone for the smallest build.
const abis = process.env.DEADRUN_ABIS || 'arm64-v8a,armeabi-v7a';
step('building the release apk for ' + abis);
console.log('  (first run downloads Gradle and compiles native code — give it a while)');
// Absolute path, quoted: cmd.exe does not resolve a bare command name out of the
// working directory the way a POSIX shell does with `./`, so `gradlew.bat` alone
// fails with "is not recognized as an internal or external command".
const gradlew = path.join(androidDir, WIN ? 'gradlew.bat' : 'gradlew');
run(
  WIN ? '"' + gradlew + '"' : gradlew,
  ['assembleRelease', '-PreactNativeArchitectures=' + abis],
  androidDir
);

/* --- 5. hand it over ----------------------------------------------------- */
const apk = path.join(androidDir, 'app/build/outputs/apk/release/app-release.apk');
if (!fs.existsSync(apk)) die('Gradle finished but no APK landed at ' + apk);

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo.version;
// Deliberately not inside OneDrive: a placeholder file uploads as empty, and
// this one is meant to be dragged onto a phone.
const downloads = path.join(os.homedir(), 'Downloads');
const dest = fs.existsSync(downloads)
  ? path.join(downloads, 'deadrun-' + version + '.apk')
  : path.join(STAGE, 'deadrun-' + version + '.apk');
fs.copyFileSync(apk, dest);

const mb = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
console.log('\n\x1b[32m*\x1b[0m DEADRUN ' + version + '  ' + mb + ' MB');
console.log('  ' + dest);
console.log('\n  Copy it to your phone and open it, or with a USB cable:');
console.log('    adb install -r "' + dest + '"\n');
