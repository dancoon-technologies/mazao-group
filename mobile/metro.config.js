const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Smaller production bundle: strip console.* in release builds
config.transformer.minifierConfig = {
  compress: {
    drop_console: true,
  },
};

module.exports = config;
