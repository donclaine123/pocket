const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Enable package.json "exports" field support for modern ESM packages like @powersync/common
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
