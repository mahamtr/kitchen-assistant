jest.mock('tamagui', () => {
  const React = require('react');
  const { Pressable, Text, TextInput, View } = require('react-native');

  function createViewComponent(displayName) {
    const Component = ({ children, testID }) => React.createElement(View, { testID }, children);

    Component.displayName = displayName;

    return Component;
  }

  function createTextComponent(displayName) {
    const Component = ({ children, testID }) => React.createElement(Text, { testID }, children);

    Component.displayName = displayName;

    return Component;
  }

  return {
    Button: ({ children, onPress, disabled, testID }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', disabled, onPress, testID }, children),
    Input: ({ testID, ...props }) => React.createElement(TextInput, { testID, ...props }),
    Paragraph: createTextComponent('Paragraph'),
    TamaguiProvider: ({ children }) => React.createElement(React.Fragment, null, children),
    Text: createTextComponent('Text'),
    Theme: ({ children }) => React.createElement(React.Fragment, null, children),
    XStack: createViewComponent('XStack'),
    YStack: createViewComponent('YStack'),
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');

  return {
    MaterialIcons: ({ name, size, color }) => React.createElement(Text, null, `${name}:${size}:${color}`),
  };
}, { virtual: true });

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');

  Reanimated.default.call = () => undefined;

  return Reanimated;
});

jest.mock('react-native/src/private/animated/NativeAnimatedHelper');

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();

  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});
