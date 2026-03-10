module.exports = function (api) {
  const isTest = api.env('test');
  const isProduction = process.env.NODE_ENV === 'production';
  api.cache(() => isTest);

  return {
    presets: [isTest ? '@react-native/babel-preset' : 'babel-preset-expo'],
    plugins: [
      !isTest && isProduction && [
        '@tamagui/babel-plugin',
        {
          components: ['tamagui'],
          config: './tamagui.config.ts',
          logTimings: true,
          disableExtraction: false,
        },
      ],
      'react-native-reanimated/plugin',
    ].filter(Boolean),
  };
};
