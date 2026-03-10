import { create } from 'zustand';

export type ToastTone = 'success' | 'warning' | 'error';

export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type UiState = {
  toasts: ToastMessage[];
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (toastId: string) => void;
};

let toastCounter = 0;

export const useUiStore = create<UiState>((set) => ({
  toasts: [],
  pushToast: (toast) =>
    set((state) => ({
      toasts: [
        ...state.toasts,
        {
          ...toast,
          id: `toast_${toastCounter += 1}`,
        },
      ].slice(-3),
    })),
  dismissToast: (toastId) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    })),
}));
