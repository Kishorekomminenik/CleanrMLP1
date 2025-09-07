const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Aggressive file watching reduction to fix ENOSPC errors
config.watchFolders = [
  __dirname + '/src',
  __dirname + '/app',
  __dirname + '/assets'
];

// Exclude test directories and node_modules subdirectories that cause issues
config.resolver.blacklistRE = /(node_modules\/.*\/(test|tests|__tests__|\.git|android|ios|windows|macos)\/.*|.*\.test\.|.*\.spec\.)/;

// Reduce workers and enable file system optimizations
config.maxWorkers = 1;
config.resetCache = true;

// Disable expensive transformations
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

module.exports = config;
