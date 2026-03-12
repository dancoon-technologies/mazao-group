const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Smaller production bundle: strip console.*, aggressive minification
config.transformer.minifierConfig = {
  compress: {
    drop_console: true,
    passes: 2,
    pure_funcs: ['console.info', 'console.debug', 'console.warn'],
  },
  mangle: {
    toplevel: true,
  },
  format: {
    comments: false,
  },
};

module.exports = config;
