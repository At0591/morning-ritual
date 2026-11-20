# KindRise

[![checks](https://github.com/At0591/morning-ritual/actions/workflows/checks.yml/badge.svg)](https://github.com/At0591/morning-ritual/actions/workflows/checks.yml)

KindRise is a gentle alarm app for Android, for people who snooze through alarms or switch them off half asleep. It was called Morning Ritual until November 2026. The repository still uses the old name.

A morning with KindRise goes like this:

1. A melodic tune starts quiet and gets louder over 30 seconds.
<!-- vale AkshayPro.Contractions = NO -->
2. You tap a rising sun five or six times to show you are awake. Touching the screen turns the tune down. There is no maths and no time limit, and a large "I can't do this today" button always works, including with a screen reader.
<!-- vale AkshayPro.Contractions = YES -->
3. You write one small good thing in a journal, or pick one of three suggestions.
4. About 10 minutes later the app asks "Still up?". One tap answers it. If you miss it, the tune plays again.

After that there is an optional ritual. The app has 41 of them, and each shows its evidence level (strong, moderate or early) and the study or source behind it. Home also shows today's sunrise and Brahma Muhurta times, worked out on the phone from an approximate location or a city you pick.

The journal and settings stay on the phone. There is no account, and anonymous usage counts are sent only if the user agrees.

## Status

This is where KindRise stood in November 2026:

* Android only. Tested on an iQOO Neo 10R (Android 16), with the app open, in the background and closed, and over the lock screen.
* Not on Google Play yet. A closed test comes first.
* Premium, payments and an iPhone version are not built yet.

## How it is built

* Expo SDK 58, React Native and TypeScript, with `expo-sqlite` for local storage.
* A native Kotlin module (`modules/alarm-scheduler`) schedules alarms with `AlarmManager.setAlarmClock` and rings through a foreground service. It also opens the wake screen over the lock screen. On Vivo, iQOO, Xiaomi, Oppo, Realme and OnePlus it uses "Display over other apps" as well, because those phones can block full-screen alarms.
* Sunrise and Brahma Muhurta come from SunCalc. Brahma Muhurta uses Drik Panchang's method: one fifteenth of the night, ending one such part before sunrise. Tests check it against Drik Panchang's published times for London and Mumbai.
* Jest tests (69) and a GitHub Actions check run on every push.

## Running it locally

The app uses native code, so Expo Go will not run it. You need Node.js 24 and the Android SDK.

```bash
git clone https://github.com/At0591/morning-ritual.git
cd morning-ritual
npm install
npx expo prebuild --platform android
npx expo run:android
```

On Windows, `scripts/build-local-apk.ps1 -Install` builds a signed release APK and installs it on a connected phone. The `scripts/alarm-check.ps1` script checks each connected phone for the settings that can stop an alarm. The `.maestro/` folder holds screen tests for [Maestro](https://maestro.mobile.dev).

## Licence

Copyright 2026 Akshay Tambe. All rights reserved. The code is public to read under the terms in `LICENSE`.
