# Submission guide

This guide covers how to submit KindRise to the App Store and Google Play. Beta testers come first, through TestFlight and Play internal testing, and a public release follows. None of it can run without paid developer accounts. The steps below are in the order to do them.

The iPhone version isn't built yet, so the Apple steps are for later.

## One-time setup

### Apple developer account ($99 a year)

* Sign up at [https://developer.apple.com/programs/enroll/](https://developer.apple.com/programs/enroll/).
* You need it for the App Store, TestFlight and in-app purchases.

### Google developer account ($25, paid once)

* This is the Google Play Console account. Sign up at [https://play.google.com/console](https://play.google.com/console).
* It covers Google Play, internal testing, in-app purchases and Android distribution.

### Apple app setup

1. Log in to [https://appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Create a new app with these details:
   * Name: KindRise
   * Bundle ID: `app.kindrise` (must match `ios.bundleIdentifier` in `app.json`)
   * SKU: anything, such as `kindrise-1`
3. Copy the Apple App ID (a 10-digit number). You'll need it for the EAS settings below.
4. Copy the Apple Team ID (10 characters). The EAS settings use it too.
5. Upload your screenshots (see `store-assets/`).
6. Fill in the app description (see `docs/store-listing-copy.md`).
7. Set the age rating to 4+.
8. Set the pricing to free with in-app purchases.
9. Once Premium is built, add the in-app purchase products:
   * Monthly: $4.99 USD, product ID `morning_ritual_premium_monthly`
   * Yearly: $29.99 USD, product ID `morning_ritual_premium_yearly`
10. Add your banking details. They're required before paid apps go live.
11. Add your tax information.
12. Add tester emails in TestFlight for internal testers.

### Android app setup

1. Log in to [https://play.google.com/console](https://play.google.com/console).
2. Create a new app with these details:
   * Name: KindRise
   * Default language: English
   * App type: App
   * Price: Free
3. The package name is `app.kindrise`, set by `android.package` in `app.json`.
4. Go to Setup > App signing and choose "Let Google manage my app signing key".
5. Go to Release > Testing > Internal testing.
6. Create a new release once there's an AAB.
7. Upload screenshots (PNG, 320 to 3840 px on the long side).
8. Fill in the app description (see `docs/store-listing-copy.md`).
9. Add a list of tester emails.
10. Once Premium is built, add the in-app products:
    * Monthly: $4.99 USD, product ID `morning_ritual_premium_monthly`
    * Yearly: $29.99 USD, product ID `morning_ritual_premium_yearly`
11. Add a service account for EAS Submit, as the next section explains.

### Service account for EAS Submit

* In Play Console, go to Setup > API access > Create service account.
* Download the JSON key.
* Save it as `store-assets/play-console-service-account.json`.
* Give the service account "Release manager" permissions.
* Don't commit this JSON to git. Add it to `.gitignore` first (see the last section).

### EAS settings

After creating the apps in both stores, replace these placeholders in `eas.json`:

* `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` with your Apple App ID
* `REPLACE_WITH_APPLE_TEAM_ID` with your Apple Team ID

The `serviceAccountKeyPath` setting already points to `./store-assets/play-console-service-account.json`.

## Building a release

Development builds are for testing on your own phone. The stores need a release build:

```bash
# Build Android release AAB (for Play Store)
eas build --profile production --platform android

# Build iOS release (for App Store)
eas build --profile production --platform ios
```

Each build takes 15 to 30 minutes and produces a signed release file.

## Submitting

Once your accounts are set up and a release build is ready, run:

```bash
# Submit Android to Play Store Internal Track
eas submit --platform android --latest

# Submit iOS to App Store Connect (then manually release to TestFlight)
eas submit --platform ios --latest
```

For TestFlight, run `eas submit --platform ios` and then log in to App Store Connect. Open My Apps > KindRise > TestFlight, where the build appears within about 5 minutes. Add testers and submit it for beta review.

## Tracking the beta

After you submit to internal testing:

* Android testers get a Google Play link and install the app from it.
* iPhone testers get a TestFlight invite email. They install the TestFlight app first.

Collect feedback in a private Slack or Discord, a shared Google Doc or GitHub Issues with the `beta` label.

Release a new build each week until the app is ready for production. A beta usually runs for 2 to 4 weeks with 10 to 50 testers.

## When ready to launch

1. On Android, promote the build from internal testing to closed testing, then open testing, then production.
2. On iPhone, submit the app for App Store review, which takes 24 to 48 hours in most cases.
3. Set a launch date.
4. Submit KindRise to Product Hunt and similar sites (see the marketing plan).

## Files to keep out of git

Add these lines to `.gitignore` before you create the service account JSON. The `*.p8`, `*.p12` and `*.key` lines are already there.

```
store-assets/play-console-service-account.json
*.p8
*.p12
*.cer
*.key
```
