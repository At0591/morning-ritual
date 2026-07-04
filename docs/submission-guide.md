# Submission Guide

> This file documents how to submit Morning Ritual to the App Store and
> Play Store for beta testing (TestFlight + Play Internal Track) and
> eventually public release. **None of this can run without paid developer
> accounts.** This file tells you exactly what to set up, in order.

## One-time setup (do this once)

### 1. Apple Developer account — $99/year
- Sign up: <https://developer.apple.com/programs/enroll/>
- Needed for: App Store, TestFlight, iOS Critical Alert entitlement, IAP

### 2. Google Play Console account — $25 one-time
- Sign up: <https://play.google.com/console>
- Needed for: Play Store, Play Internal testing, IAP, Android distribution

### 3. App Store Connect setup (Apple)
1. Log in to <https://appstoreconnect.apple.com>
2. Create a new app:
   - Name: **Morning Ritual**
   - Bundle ID: **app.morningritual.client** (must match `app.json` `ios.bundleIdentifier`)
   - SKU: anything (e.g., `morning-ritual-1`)
3. Copy the **Apple App ID** (a 10-digit number) — used below
4. Copy the **Apple Team ID** (10 chars) — used below
5. Upload your screenshots (see `store-assets/`)
6. Fill in app description (see `docs/store-listing-copy.md`)
7. Set age rating: 4+
8. Pricing: Free with in-app purchases
9. **IAP products** (after IAP is re-enabled):
   - Monthly: $3.99 USD, product ID `morning_ritual_premium_monthly`
   - Yearly: $29.99 USD, product ID `morning_ritual_premium_yearly`
10. Add **banking** (required before paid apps go live)
11. Add **tax info**
12. Add **tester emails** in TestFlight (for internal testers)

### 4. Google Play Console setup (Android)
1. Log in to <https://play.google.com/console>
2. Create a new app:
   - Name: **Morning Ritual**
   - Default language: English
   - App type: App
   - Free
3. Go to **Setup → App signing** → choose "Let Google manage my app signing key"
4. Go to **Release → Testing → Internal testing**
5. Create a new release (after we have an AAB)
6. Upload screenshots (PNG, 320-3840px on the long side)
7. Fill in app description (see `docs/store-listing-copy.md`)
8. Add a tester email list
9. **IAP products** (after IAP is re-enabled):
   - Monthly: $3.99 USD, product ID `morning_ritual_premium_monthly`
   - Yearly: $29.99 USD, product ID `morning_ritual_premium_yearly`
10. Add a **service account** for EAS Submit:
    - Play Console → Setup → API access → Create service account
    - Download the JSON key
    - Save as `store-assets/play-console-service-account.json`
    - Grant the service account "Release manager" permissions
    - **DO NOT** commit this JSON to git — add to `.gitignore`

### 5. Update `eas.json`
After creating the apps in both stores, update these placeholders:
- `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` → your Apple App ID
- `REPLACE_WITH_APPLE_TEAM_ID` → your Apple Team ID
- `serviceAccountKeyPath` → already set to `./store-assets/play-console-service-account.json`

## Building a release

The dev APK we've been building is for development only. For submission, we need a release build:

```bash
# Build Android release AAB (for Play Store)
eas build --profile production --platform android

# Build iOS release (for App Store)
eas build --profile production --platform ios
```

These take 15-30 min each. The output is a signed release artifact.

## Submitting

After your accounts are set up and a release build is ready:

```bash
# Submit Android to Play Store Internal Track
eas submit --platform android --latest

# Submit iOS to App Store Connect (then manually release to TestFlight)
eas submit --platform ios --latest
```

For TestFlight specifically: after `eas submit --platform ios`, log into
App Store Connect → My Apps → Morning Ritual → TestFlight tab → the
build will appear within ~5 min. Add testers and submit for beta review.

## Tracking the beta

After submitting to internal testing:
- **Android**: testers get a Play Store link, install the app
- **iOS**: testers get a TestFlight invite email, install the TestFlight app first

Collect feedback in:
- A private Slack/Discord
- A shared Google Doc
- GitHub Issues (with the `beta` label)

Iterate weekly until you're ready for production. A typical beta cycle
is 2-4 weeks with 10-50 testers.

## When ready to launch

For production:
1. Promote from Internal → Closed Beta → Open Beta → Production (Android)
2. Submit for App Store review (iOS) — typically 24-48h review
3. Set a launch date
4. Submit to Product Hunt, etc. (see marketing plan)

## .gitignore additions needed

Add to `.gitignore` BEFORE creating the service account JSON:
```
store-assets/play-console-service-account.json
*.p8
*.p12
*.cer
*.key
```
