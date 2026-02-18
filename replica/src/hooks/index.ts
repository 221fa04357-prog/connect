
import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
// Updated import to point to the new centralized UI index
import { ToastActionElement, ToastProps } from '@/components/ui';

// --- use-mobile.tsx ---
const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

    React.useEffect(() => {
        const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
        const onChange = () => {
            setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        };
        mql.addEventListener('change', onChange);
        setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return !!isMobile;
}

// --- useResponsive.ts ---
export const useResponsive = () => {
    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
    });

    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight,
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return {
        isMobile: windowSize.width < 768,
        isTablet: windowSize.width >= 768 && windowSize.width < 1024,
        isDesktop: windowSize.width >= 1024,
        width: windowSize.width,
        height: windowSize.height,
    };
};

// --- useActiveSpeaker.ts ---
export const useActiveSpeaker = () => {
    const { participants, setActiveSpeaker } = useParticipantsStore();

    useEffect(() => {
        // Simulate active speaker changes every 3-5 seconds
        const interval = setInterval(() => {
            const unmutedParticipants = participants.filter((p) => !p.isAudioMuted);

            if (unmutedParticipants.length > 0) {
                const randomSpeaker = unmutedParticipants[
                    Math.floor(Math.random() * unmutedParticipants.length)
                ];
                setActiveSpeaker(randomSpeaker.id);
            } else {
                setActiveSpeaker(null);
            }
        }, 3000 + Math.random() * 2000);

        return () => clearInterval(interval);
    }, [participants, setActiveSpeaker]);
};

// --- use-toast.ts ---
const TOAST_LIMIT = 1;
const TOAST_REMOVE_DELAY = 1000000;

type ToasterToast = ToastProps & {
    id: string;
    title?: React.ReactNode;
    description?: React.ReactNode;
    action?: ToastActionElement;
};

const actionTypes = {
    ADD_TOAST: 'ADD_TOAST',
    UPDATE_TOAST: 'UPDATE_TOAST',
    DISMISS_TOAST: 'DISMISS_TOAST',
    REMOVE_TOAST: 'REMOVE_TOAST',
} as const;

let count = 0;

function genId() {
    count = (count + 1) % Number.MAX_SAFE_INTEGER;
    return count.toString();
}

type ActionType = typeof actionTypes;

type Action =
    | {
        type: ActionType['ADD_TOAST'];
        toast: ToasterToast;
    }
    | {
        type: ActionType['UPDATE_TOAST'];
        toast: Partial<ToasterToast>;
    }
    | {
        type: ActionType['DISMISS_TOAST'];
        toastId?: ToasterToast['id'];
    }
    | {
        type: ActionType['REMOVE_TOAST'];
        toastId?: ToasterToast['id'];
    };

interface State {
    toasts: ToasterToast[];
}

const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

const addToRemoveQueue = (toastId: string) => {
    if (toastTimeouts.has(toastId)) {
        return;
    }

    const timeout = setTimeout(() => {
        toastTimeouts.delete(toastId);
        dispatch({
            type: 'REMOVE_TOAST',
            toastId: toastId,
        });
    }, TOAST_REMOVE_DELAY);

    toastTimeouts.set(toastId, timeout);
};

export const reducer = (state: State, action: Action): State => {
    switch (action.type) {
        case 'ADD_TOAST':
            return {
                ...state,
                toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
            };

        case 'UPDATE_TOAST':
            return {
                ...state,
                toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
            };

        case 'DISMISS_TOAST': {
            const { toastId } = action;

            // ! Side effects ! - This could be extracted into a dismissToast() action,
            // but I'll keep it here for simplicity
            if (toastId) {
                addToRemoveQueue(toastId);
            } else {
                state.toasts.forEach((toast) => {
                    addToRemoveQueue(toast.id);
                });
            }

            return {
                ...state,
                toasts: state.toasts.map((t) =>
                    t.id === toastId || toastId === undefined
                        ? {
                            ...t,
                            open: false,
                        }
                        : t
                ),
            };
        }
        case 'REMOVE_TOAST':
            if (action.toastId === undefined) {
                return {
                    ...state,
                    toasts: [],
                };
            }
            return {
                ...state,
                toasts: state.toasts.filter((t) => t.id !== action.toastId),
            };
    }
};

const listeners: Array<(state: State) => void> = [];

let memoryState: State = { toasts: [] };

function dispatch(action: Action) {
    memoryState = reducer(memoryState, action);
    listeners.forEach((listener) => {
        listener(memoryState);
    });
}

type Toast = Omit<ToasterToast, 'id'>;

function toast({ ...props }: Toast) {
    const id = genId();

    const update = (props: ToasterToast) =>
        dispatch({
            type: 'UPDATE_TOAST',
            toast: { ...props, id },
        });
    const dismiss = () => dispatch({ type: 'DISMISS_TOAST', toastId: id });

    dispatch({
        type: 'ADD_TOAST',
        toast: {
            ...props,
            id,
            open: true,
            onOpenChange: (open) => {
                if (!open) dismiss();
            },
        },
    });

    return {
        id: id,
        dismiss,
        update,
    };
}

function useToast() {
    const [state, setState] = React.useState<State>(memoryState);

    React.useEffect(() => {
        listeners.push(setState);
        return () => {
            const index = listeners.indexOf(setState);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        };
    }, [state]);

    return {
        ...state,
        toast,
        dismiss: (toastId?: string) => dispatch({ type: 'DISMISS_TOAST', toastId }),
    };
}

export { useToast, toast };
