// expo-modules.config.js
// Tells the Expo Modules autolinking v2 to include our local modules
// in the runtime registry (ExpoModulesPackageList.java).
// Without this, the local `alarm-scheduler` module is linked as a Gradle
// dependency but is NOT registered as a native module in the runtime
// package list — leading to "Cannot find native module" errors.
module.exports = {
  modules: ['./modules/alarm-scheduler'],
};
