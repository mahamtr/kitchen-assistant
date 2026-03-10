import { act, fireEvent, screen } from '@testing-library/react-native';
import ToastHost from './ToastHost';
import { renderWithProviders } from '../../test/render';
import { useUiStore } from '../../lib/store/uiStore';

describe('ToastHost', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useUiStore.setState((state) => ({ ...state, toasts: [] }));
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    act(() => {
      useUiStore.setState((state) => ({ ...state, toasts: [] }));
    });
  });

  it('renders store toasts and dismisses them when pressed', () => {
    act(() => {
      useUiStore.getState().pushToast({
        title: 'Saved to inventory',
        description: 'The mock repository was updated.',
        tone: 'success',
      });
    });

    renderWithProviders(<ToastHost />);

    expect(screen.getByText('Saved to inventory')).toBeTruthy();
    act(() => {
      fireEvent.press(screen.getByText('Saved to inventory'));
    });

    expect(screen.queryByText('Saved to inventory')).toBeNull();
  });

  it('auto-dismisses toast messages after the display timeout', () => {
    act(() => {
      useUiStore.getState().pushToast({
        title: 'Expiring soon',
        description: 'Move yogurt into tonight’s meal.',
        tone: 'warning',
      });
    });

    renderWithProviders(<ToastHost />);

    expect(screen.getByText('Expiring soon')).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3600);
    });

    expect(screen.queryByText('Expiring soon')).toBeNull();
  });
});
