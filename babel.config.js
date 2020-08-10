module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        useBuiltIns: 'entry',
        corejs: { version: '3.6.4', proposals: true },
        modules: 'commonjs',
      },
    ],
  ],
  plugins: [['@babel/plugin-transform-runtime', { useESModules: false }]],
};
