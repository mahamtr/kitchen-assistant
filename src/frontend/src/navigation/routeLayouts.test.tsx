import { screen } from '@testing-library/react-native';
import AppRoutesLayout from '../../app/(app)/_layout';
import KitchenRoutesLayout from '../../app/(app)/kitchen/_layout';
import PlannerRoutesLayout from '../../app/(app)/planner/_layout';
import RecipesRoutesLayout from '../../app/(app)/recipes/_layout';
import { renderWithProviders } from '../test/render';

jest.mock('expo-router', () => {
  const React = require('react');
  const { View } = require('react-native');

  const Stack = ({ children, screenOptions }) => React.createElement(View, { testID: 'stack', screenOptions }, children);

  Stack.Screen = ({ name, options }) => React.createElement(View, { testID: `screen:${name}`, name, options });

  return { Stack };
});

describe('route layouts', () => {
  it('uses fade transitions for peer app destinations', () => {
    renderWithProviders(<AppRoutesLayout />);

    expect(screen.getByTestId('stack').props.screenOptions).toMatchObject({
      animation: 'fade',
      animationDuration: 160,
      headerShown: false,
    });
  });

  it('keeps the planner root subtle and the chat flow push-based', () => {
    renderWithProviders(<PlannerRoutesLayout />);

    expect(screen.getByTestId('screen:index').props.options).toMatchObject({
      animation: 'fade',
      animationDuration: 160,
    });
    expect(screen.getByTestId('screen:chat').props.options).toMatchObject({
      animation: 'slide_from_right',
      animationTypeForReplace: 'push',
    });
  });

  it('uses push-style motion for recipe detail and chef chat', () => {
    renderWithProviders(<RecipesRoutesLayout />);

    expect(screen.getByTestId('screen:index').props.options).toMatchObject({
      animation: 'fade',
      animationDuration: 160,
    });
    expect(screen.getByTestId('screen:[recipeId]').props.options).toMatchObject({
      animation: 'slide_from_right',
      animationTypeForReplace: 'push',
    });
    expect(screen.getByTestId('screen:chat/[generationId]').props.options).toMatchObject({
      animation: 'slide_from_right',
      animationTypeForReplace: 'push',
    });
  });

  it('uses fade for kitchen main states, push for OCR review, and sheets for item editors', () => {
    renderWithProviders(<KitchenRoutesLayout />);

    expect(screen.getByTestId('screen:to-buy').props.options).toMatchObject({
      animation: 'fade',
      animationDuration: 160,
    });
    expect(screen.getByTestId('screen:in-stock').props.options).toMatchObject({
      animation: 'fade',
      animationDuration: 160,
    });
    expect(screen.getByTestId('screen:expiring').props.options).toMatchObject({
      animation: 'fade',
      animationDuration: 160,
    });
    expect(screen.getByTestId('screen:ocr/review').props.options).toMatchObject({
      animation: 'slide_from_right',
      animationTypeForReplace: 'push',
    });
    expect(screen.getByTestId('screen:item/[itemId]').props.options).toMatchObject({
      animation: 'slide_from_bottom',
      gestureEnabled: true,
      presentation: 'modal',
    });
    expect(screen.getByTestId('screen:ocr/item/[lineId]').props.options).toMatchObject({
      animation: 'slide_from_bottom',
      gestureEnabled: true,
      presentation: 'modal',
    });
  });
});
