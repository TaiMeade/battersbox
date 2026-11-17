// Metro config — adds .sql to source extensions so Drizzle migrations
// can be bundled via babel-plugin-inline-import, and .wasm as an asset so
// expo-sqlite's web build (wa-sqlite) can load in the browser.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('sql');
config.resolver.assetExts.push('wasm');

// The web database needs SharedArrayBuffer, which browsers only allow on a
// cross-origin-isolated page. The production server sends the same headers.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  return middleware(req, res, next);
};

module.exports = config;
