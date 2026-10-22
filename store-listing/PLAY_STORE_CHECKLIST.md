# Tile Pop – Google Play submission pack

## 1. Assets (this folder)
| Play Console field | File | Spec |
|---|---|---|
| App icon | `app-icon-512.png` | 512×512 PNG |
| Feature graphic (cover) | `feature-graphic-1024x500.png` | 1024×500 |
| Phone screenshots (6) | `screenshots/01–06.png` | 1080×1920, 9:16 (min 2, max 8) |

## 2. Store listing text
**App name (30):** Tile Pop: Match & Explore
**Short description (80):** Match tiles, clear the tray and explore the world in this relaxing puzzle.
**Full description (4000):**
Tile Pop is a relaxing tile-matching puzzle. Tap tiles to send them to your tray, match 3 of a kind to clear them, and don't let the tray fill up!

- Easy to learn: a guided tutorial gets you playing in seconds
- Hundreds of levels as you travel from country to country
- Chain combos for big scores
- Helpful boosters: Undo, Wand and Shuffle
- Colour-friendly mode, sound and music controls
- Available in English, Español, Français, हिन्दी and ગુજરાતી
- No sign-up needed. Your progress stays on your device

Download Tile Pop and start matching!

**Category:** Games → Puzzle  **Tags:** Puzzle, Casual, Offline
**Contact email:** vintrakart@gmail.com (already in app Support)

## 3. Release blockers to fix BEFORE uploading
1. **Privacy Policy URL (required).** The app only shows policy text inside Settings. Play requires a public web URL. Host the text from `settings.privacyText` (e.g. GitHub Pages) and paste the URL in Console → App content.
2. **Shop shows real prices ($0.49–$11.99) but buying does nothing** (it only shows "unavailable"). This can get the app rejected as misleading. Either integrate Google Play Billing, or hide the Offers/coin packs for v1.
3. **Release signing.** build.gradle falls back to the *debug* key if no upload key is set. Create an upload keystore and set the `TILEPOP_UPLOAD_*` properties in `~/.gradle/gradle.properties`:
   `keytool -genkeypair -v -storetype PKCS12 -keystore tilepop-upload.jks -alias tilepop -keyalg RSA -keysize 2048 -validity 10000`
   Back this file up. Losing it is painful.
4. **Application ID** is `com.tilematchgame`. It can never change after publishing, so make sure you are happy with it (e.g. `com.sofscript.tilepop`).
5. **Version:** versionCode 1 / versionName "1.0" in build.gradle vs "0.0.1" in package.json and APP_CONFIG. Align them. Increase versionCode on every upload.
6. **Build an AAB (Play requires AAB, not APK):**
   `cd android && gradlew bundleRelease` → `android/app/build/outputs/bundle/release/app-release.aab`
7. Optional: set `enableProguardInReleaseBuilds = true` to shrink, then test the release build.
8. **New personal developer accounts:** run a closed test with 12+ testers for 14 days before production access.

Already fine: targetSdk 36, minSdk 24, 64-bit (arm64-v8a included), no ads SDK, no analytics (Noop), allowBackup=false, notification permission requested at runtime.

## 4. App content declarations (Console → App content)
- **Privacy policy:** URL from item 3
- **Ads:** No, the app contains no ads
- **App access:** All functionality available without login
- **Target audience:** 13+ recommended (or 18+). Choosing under‑13 triggers the Families policy and extra rules
- **Content rating (IARC questionnaire):** no violence, no sexual content, no user‑to‑user interaction, no real-money gambling → expect Everyone / PEGI 3
- **News app / Government / Health / Financial:** No
- **Data safety:**
  - Collects/shares any user data: **No** (progress, coins and settings stay on device; no account, no analytics, no ads)
  - If you turn on cloud save/leaderboard later, declare "App activity / Other user‑generated content" as collected, encrypted in transit, deletable on request
  - Data encrypted in transit: Yes (only matters if cloud is used)
- **Permissions in manifest:** INTERNET, VIBRATE, POST_NOTIFICATIONS. All are normal/runtime and need no special declaration
- **Account deletion:** not applicable (no accounts)
