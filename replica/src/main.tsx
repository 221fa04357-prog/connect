import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global HTTP fetch override for ngrok development URLs to bypass the browser warning page
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
    if (url.includes('ngrok-free.app')) {
        init = init || {};
        init.headers = {
            ...init.headers,
            'ngrok-skip-browser-warning': 'true'
        };
    }
    return originalFetch(input, init);
};

createRoot(document.getElementById('root')!).render(<App />);
