import { create } from 'zustand';

interface UIState {
  isChatOpen: boolean;
  isParticipantsOpen: boolean;
  isSettingsOpen: boolean;
  isWhiteboardOpen: boolean;
  isBreakoutRoomsOpen: boolean;
  isPollsOpen: boolean;
  isVirtualBackgroundOpen: boolean;
  isReactionsOpen: boolean;
  showLeaveConfirmation: boolean;
  activeModal: string | null;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  
  // Actions
  toggleChat: () => void;
  toggleParticipants: () => void;
  toggleSettings: () => void;
  toggleWhiteboard: () => void;
  toggleBreakoutRooms: () => void;
  togglePolls: () => void;
  toggleVirtualBackground: () => void;
  toggleReactions: () => void;
  setShowLeaveConfirmation: (show: boolean) => void;
  setActiveModal: (modal: string | null) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  closeToast: () => void;
  closeAllPanels: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isChatOpen: false,
  isParticipantsOpen: false,
  isSettingsOpen: false,
  isWhiteboardOpen: false,
  isBreakoutRoomsOpen: false,
  isPollsOpen: false,
  isVirtualBackgroundOpen: false,
  isReactionsOpen: false,
  showLeaveConfirmation: false,
  activeModal: null,
  toast: null,
  
  toggleChat: () => set((state) => ({
    isChatOpen: !state.isChatOpen,
    isParticipantsOpen: false,
  })),
  
  toggleParticipants: () => set((state) => ({
    isParticipantsOpen: !state.isParticipantsOpen,
    isChatOpen: false,
  })),
  
  toggleSettings: () => set((state) => ({
    isSettingsOpen: !state.isSettingsOpen,
  })),
  
  toggleWhiteboard: () => set((state) => ({
    isWhiteboardOpen: !state.isWhiteboardOpen,
  })),
  
  toggleBreakoutRooms: () => set((state) => ({
    isBreakoutRoomsOpen: !state.isBreakoutRoomsOpen,
  })),
  
  togglePolls: () => set((state) => ({
    isPollsOpen: !state.isPollsOpen,
  })),
  
  toggleVirtualBackground: () => set((state) => ({
    isVirtualBackgroundOpen: !state.isVirtualBackgroundOpen,
  })),
  
  toggleReactions: () => set((state) => ({
    isReactionsOpen: !state.isReactionsOpen,
  })),
  
  setShowLeaveConfirmation: (show) => set({ showLeaveConfirmation: show }),
  
  setActiveModal: (modal) => set({ activeModal: modal }),
  
  showToast: (message, type) => set({ toast: { message, type } }),
  
  closeToast: () => set({ toast: null }),
  
  closeAllPanels: () => set({
    isChatOpen: false,
    isParticipantsOpen: false,
    isWhiteboardOpen: false,
    isBreakoutRoomsOpen: false,
    isPollsOpen: false,
    isVirtualBackgroundOpen: false,
    isReactionsOpen: false,
  }),
}));