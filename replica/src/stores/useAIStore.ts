import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ActionItem {
    id: string;
    text: string;
    completed: boolean;
}

interface AIMessage {
    id: string;
    sender: 'user' | 'ai';
    content: string;
    timestamp: Date;
    isThinking?: boolean;
}

interface AIState {
    currentMeetingId: string | null;
    summaryPoints: string[];
    actionItems: ActionItem[];
    aiMessages: AIMessage[];
    isGeneratingSummary: boolean;
    isSuggestingActions: boolean;

    // Actions
    setCurrentMeetingId: (id: string | null) => void;
    setSummaryPoints: (points: string[]) => void;
    addSummaryPoint: (point: string) => void;
    setActionItems: (items: ActionItem[]) => void;
    addActionItem: (text: string) => void;
    toggleActionItem: (id: string) => void;
    removeActionItem: (id: string) => void;
    setAiMessages: (messages: AIMessage[]) => void;
    addAiMessage: (message: AIMessage) => void;
    setIsGeneratingSummary: (isGenerating: boolean) => void;
    setIsSuggestingActions: (isSuggesting: boolean) => void;
    reset: () => void;
}

export const useAIStore = create<AIState>()(
    persist(
        (set) => ({
            currentMeetingId: null,
            summaryPoints: [],
            actionItems: [],
            aiMessages: [
                {
                    id: 'welcome',
                    sender: 'ai',
                    content: "Hi! I'm your AI Companion. I can help you catch up, summarize discussions, or answer questions about the meeting.",
                    timestamp: new Date(),
                }
            ],
            isGeneratingSummary: false,
            isSuggestingActions: false,

            setCurrentMeetingId: (id) => set({ currentMeetingId: id }),
            setSummaryPoints: (points) => set({ summaryPoints: points }),
            addSummaryPoint: (point) => set((state) => ({
                summaryPoints: [...state.summaryPoints, point]
            })),

            setActionItems: (items) => set({ actionItems: items }),
            addActionItem: (text) => set((state) => ({
                actionItems: [
                    ...state.actionItems,
                    { id: Date.now().toString(), text, completed: false }
                ]
            })),

            toggleActionItem: (id) => set((state) => ({
                actionItems: state.actionItems.map((item) =>
                    item.id === id ? { ...item, completed: !item.completed } : item
                )
            })),

            removeActionItem: (id) => set((state) => ({
                actionItems: state.actionItems.filter((item) => item.id !== id)
            })),

            setAiMessages: (messages) => set({ aiMessages: messages }),
            addAiMessage: (message) => set((state) => ({
                aiMessages: [...state.aiMessages, message]
            })),

            setIsGeneratingSummary: (isGenerating) => set({ isGeneratingSummary: isGenerating }),
            setIsSuggestingActions: (isSuggesting) => set({ isSuggestingActions: isSuggesting }),

            reset: () => set({
                currentMeetingId: null,
                summaryPoints: [],
                actionItems: [],
                aiMessages: [
                    {
                        id: 'welcome',
                        sender: 'ai',
                        content: "Hi! I'm your AI Companion. I can help you catch up, summarize discussions, or answer questions about the meeting.",
                        timestamp: new Date(),
                    }
                ],
                isGeneratingSummary: false,
                isSuggestingActions: false
            }),
        }),
        {
            name: 'ai-store',
            storage: createJSONStorage(() => sessionStorage),
            onRehydrateStorage: () => (state) => {
                // Convert timestamp strings back to Date objects
                if (state && state.aiMessages) {
                    state.aiMessages = state.aiMessages.map(m => ({
                        ...m,
                        timestamp: new Date(m.timestamp)
                    }));
                }
            }
        }
    )
);
