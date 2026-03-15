#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"

echo "==> Clearing caches..."
rm -rf "$PROJECT_DIR/.expo"
rm -rf /tmp/metro-*
rm -rf /tmp/haste-map-*

echo "==> Running expo prebuild --clean..."
cd "$PROJECT_DIR"
npx expo prebuild --clean

echo "==> Restoring local.properties..."
echo "sdk.dir=$HOME/Android/Sdk" > "$ANDROID_DIR/local.properties"

echo "==> Patching build.gradle (AsyncStorage local repo)..."
sed -i "/maven { url 'https:\/\/www.jitpack.io' }/a\\
    maven { url \"\${rootProject.projectDir}/../node_modules/@react-native-async-storage/async-storage/android/local_repo\" }" \
  "$ANDROID_DIR/build.gradle"

echo "==> Restoring debug keystore..."
cp "$PROJECT_DIR/debug.keystore" "$ANDROID_DIR/app/debug.keystore"

echo "==> Building release APK..."
cd "$ANDROID_DIR"
./gradlew assembleRelease --no-daemon

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
DEST="/mnt/c/Users/mgrif/Downloads/fiberphoto.apk"

if [ -d "/mnt/c/Users/mgrif/Downloads" ]; then
  cp "$APK_PATH" "$DEST"
  echo "==> APK copied to $DEST"
else
  echo "==> APK at $APK_PATH"
fi

echo "==> Done!"
