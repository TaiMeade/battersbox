// Metro config — adds .sql to source extensions so Drizzle migrations
// can be bundled via babel-plugin-inline-import.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');

module.exports = config;
