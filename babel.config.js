module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Lets us `import migration from './0000_x.sql'` as a plain string.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
