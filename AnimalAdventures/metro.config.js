// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for .lottie assets used by lottie-react-native
config.resolver.assetExts = [...config.resolver.assetExts, 'lottie'];

module.exports = config;
