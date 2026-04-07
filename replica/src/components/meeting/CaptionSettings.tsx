import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, X, Lock } from 'lucide-react';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useChatStore } from '@/stores/useChatStore';
import { Button } from '@/components/ui';

const QUICK_LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Gujarati', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean', 'Arabic'];

const LANGUAGES = [
    'Afrikaans', 'Albanian', 'Amharic', 'Arabic', 'Armenian', 'Assamese', 'Azerbaijani',
    'Bashkir', 'Basque', 'Belarusian', 'Bengali', 'Bosnian', 'Breton', 'Bulgarian', 'Burmese',
    'Cantonese', 'Catalan', 'Chinese (Simplified)', 'Chinese (Traditional)', 'Croatian', 'Czech',
    'Danish', 'Dutch',
    'English', 'Estonian',
    'Faroese', 'Finnish', 'French',
    'Galician', 'Georgian', 'German', 'Greek', 'Gujarati',
    'Haitian Creole', 'Hausa', 'Hawaiian', 'Hebrew', 'Hindi', 'Hungarian',
    'Icelandic', 'Indonesian', 'Italian',
    'Japanese', 'Javanese',
    'Kannada', 'Kazakh', 'Khmer', 'Korean',
    'Lao', 'Latin', 'Latvian', 'Lithuanian', 'Luxembourgish',
    'Macedonian', 'Malagasy', 'Malay', 'Malayalam', 'Maltese', 'Maori', 'Marathi', 'Mongolian',
    'Nepali', 'Norwegian',
    'Occitan',
    'Pashto', 'Persian', 'Polish', 'Portuguese', 'Punjabi',
    'Romanian', 'Russian',
    'Sanskrit', 'Serbian', 'Shona', 'Sindhi', 'Sinhala', 'Slovak', 'Slovenian', 'Somali', 'Spanish', 'Sundanese', 'Swahili', 'Swedish',
    'Tagalog', 'Tajik', 'Tamil', 'Tatar', 'Telugu', 'Thai', 'Tibetan', 'Turkish', 'Turkmen',
    'Ukrainian', 'Urdu', 'Uzbek',
    'Vietnamese',
    'Welsh',
    'Yiddish', 'Yoruba'
].sort();

export function CaptionSettings() {
    const {
        isSettingsOpen,
        setSettingsOpen,
        speakingLanguage,
        setSpeakingLanguage,
        translationLanguage,
        setTranslationLanguage,
        isTranscriptionEnabled,
        setTranscriptionEnabled,
        fontType, setFontType,
        fontSize, setFontSize,
        captionColor, setCaptionColor,
        captionPosition, setCaptionPosition
    } = useTranscriptionStore();

    const { meeting } = useMeetingStore();
    const { user } = useAuthStore();
    const { meetingId } = useChatStore();

    // Changes
    // Check if user is host
    const isJoinedAsHost = user?.id === meeting?.hostId || user?.role === 'host' || user?.id === 'host';

    // Check caption settings
    const isLanguageLocked = meeting?.settings?.captionLanguageLocked === true;
    const isCaptionsAllowed = meeting?.settings?.captionsAllowed !== false;

    const [view, setView] = useState<'main' | 'speaking' | 'translation'>('main');

    if (!isSettingsOpen) return null;

    const handleSelectLanguage = (lang: string) => {
        setSpeakingLanguage(lang);
    };

    const handleSave = () => {
        setTranscriptionEnabled(true); // Automatically turn on captions when user interacts with settings
        setSettingsOpen(false);
        setView('main');

        import('sonner').then(({ toast }) => {
            toast.success(`Caption language changed to ${speakingLanguage}`);
        });
    };

    return (
        <AnimatePresence>
            {isSettingsOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center pointer-events-auto">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSettingsOpen(false)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Bottom Sheet Modal */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full sm:max-w-md bg-[#1C1C1C] rounded-t-3xl sm:rounded-3xl border border-[#333] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                        {/* Pull Bar (Mobile) */}
                        <div className="w-12 h-1.5 bg-[#404040] rounded-full mx-auto mt-3 mb-2 sm:hidden" />

                        {/* VIEW: MAIN SETTINGS */}
                        {view === 'main' && (
                            <div className="flex flex-col h-full">
                                <div className="flex items-center justify-between p-4 border-b border-[#333]">
                                    <button
                                        onClick={() => setSettingsOpen(false)}
                                        className="p-2 hover:bg-[#2D2D2D] rounded-full transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>
                                    <h2 className="text-xl font-bold">Caption settings</h2>
                                    <button
                                        onClick={handleSave}
                                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-xl transition-all shadow-lg active:scale-95"
                                    >
                                        Apply
                                    </button>
                                </div>

                                <div className="p-4 space-y-4">
                                    {/* Enable/Disable Toggle */}
                                    <div className="flex items-center justify-between p-4 bg-[#2D2D2D] rounded-2xl border border-[#333]">
                                        <span className="text-gray-200 font-medium">Show captions</span>
                                        <button
                                            onClick={() => setTranscriptionEnabled(!isTranscriptionEnabled)}
                                            className={`w-12 h-6 rounded-full transition-colors relative ${isTranscriptionEnabled ? 'bg-blue-600' : 'bg-[#404040]'}`}
                                        >
                                            <motion.div
                                                animate={{ x: isTranscriptionEnabled ? 26 : 2 }}
                                                className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-md"
                                            />
                                        </button>
                                    </div>

                                    {/* Language Selector Trigger */}
                                    <button
                                        onClick={() => {
                                            if (isLanguageLocked && !isJoinedAsHost) return;
                                            setView('speaking');
                                        }}
                                        disabled={isLanguageLocked && !isJoinedAsHost}
                                        className={`w-full flex items-center justify-between p-4 bg-[#2D2D2D] rounded-2xl transition-all group border ${isLanguageLocked && !isJoinedAsHost ? 'opacity-50 cursor-not-allowed border-[#333]' : 'hover:bg-[#3D3D3D] border-transparent hover:border-blue-500/30'}`}
                                    >
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-200 font-medium">My speaking language</span>
                                            {isLanguageLocked && !isJoinedAsHost && (
                                                <span className="text-[10px] text-yellow-500 flex items-center gap-1 font-semibold uppercase tracking-wider">
                                                    <Lock className="w-3 h-3" /> Locked by Host
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-400 font-medium font-mono text-sm uppercase tracking-wider">
                                                {speakingLanguage}
                                            </span>
                                            <ChevronRight className={`w-5 h-5 ${isLanguageLocked && !isJoinedAsHost ? 'text-gray-600' : 'text-gray-500'}`} />
                                        </div>
                                    </button>

                                    {/* Translation Selector Trigger */}
                                    <button
                                        onClick={() => setView('translation')}
                                        className="w-full flex items-center justify-between p-4 bg-[#2D2D2D] rounded-2xl transition-all group border border-transparent hover:border-blue-500/30 hover:bg-[#3D3D3D]"
                                    >
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-200 font-medium">Translate captions to</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-400 font-medium font-mono text-sm uppercase tracking-wider">
                                                {translationLanguage}
                                            </span>
                                            <ChevronRight className="text-gray-500 w-5 h-5" />
                                        </div>
                                    </button>

                                    {/* Appearance Settings */}
                                    <div className="space-y-3 p-4 bg-[#2D2D2D] rounded-2xl border border-[#333]">
                                        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Appearance</h3>

                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-200 font-medium text-sm">Font Style</span>
                                            <select
                                                value={fontType}
                                                onChange={(e) => setFontType(e.target.value)}
                                                className="bg-[#1C1C1C] border border-[#333] text-sm text-white rounded-lg px-2 py-1 outline-none"
                                            >
                                                <option value="Inter">Inter</option>
                                                <option value="Mono">Monospace</option>
                                                <option value="Serif">Serif</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-200 font-medium text-sm">Font Size</span>
                                            <select
                                                value={fontSize}
                                                onChange={(e) => setFontSize(e.target.value)}
                                                className="bg-[#1C1C1C] border border-[#333] text-sm text-white rounded-lg px-2 py-1 outline-none"
                                            >
                                                <option value="small">Small</option>
                                                <option value="normal">Normal</option>
                                                <option value="large">Large</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-200 font-medium text-sm">Color</span>
                                            <div className="flex gap-2">
                                                {['white', 'yellow', 'green', 'black'].map(c => (
                                                    <button
                                                        key={c}
                                                        onClick={() => setCaptionColor(c)}
                                                        className={`w-5 h-5 rounded-full border-2 ${captionColor === c ? 'border-blue-500 scale-110' : 'border-gray-500'} transition-transform bg-${c === 'white' ? 'white' : c === 'black' ? 'black' : c + '-400'}`}
                                                        style={{ backgroundColor: c === 'yellow' ? '#facc15' : c === 'green' ? '#4ade80' : c }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-200 font-medium text-sm">Position</span>
                                            <select
                                                value={captionPosition}
                                                onChange={(e) => setCaptionPosition(e.target.value as 'bottom' | 'floating')}
                                                className="bg-[#1C1C1C] border border-[#333] text-sm text-white rounded-lg px-2 py-1 outline-none"
                                            >
                                                <option value="bottom">Bottom Overlay</option>
                                                <option value="floating">Top Floating</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 min-h-[60px]" />
                            </div>
                        )}

                        {/* VIEW: SPEAKING LANGUAGE SELECTOR */}
                        {view === 'speaking' && (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="flex items-center justify-between p-4 border-b border-[#333]">
                                    <button
                                        onClick={() => setView('main')}
                                        className="p-2 hover:bg-[#2D2D2D] rounded-full"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <h2 className="text-xl font-bold">Speaking language</h2>
                                    <button
                                        onClick={handleSave}
                                        className="text-white bg-blue-600 font-bold px-4 py-1.5 rounded-lg hover:bg-blue-500 transition-all"
                                    >
                                        Save
                                    </button>
                                </div>

                                {/* Side Scrolling Quick Select */}
                                <div className="flex flex-col border-b border-[#333] bg-[#1a1a1a]/50">
                                    <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-gray-500 font-bold">Quick Select</div>
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4 pb-4">
                                        {QUICK_LANGUAGES.map(lang => (
                                            <button
                                                key={lang}
                                                onClick={() => handleSelectLanguage(lang)}
                                                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all ${lang === speakingLanguage
                                                    ? 'bg-blue-500 text-white shadow-blue-500/20 shadow-lg'
                                                    : 'bg-[#2D2D2D] text-gray-300 hover:bg-[#3D3D3D]'
                                                    }`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Full List (Vertical) */}
                                <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                    <div className="px-4 py-2 text-[10px] uppercase tracking-widest text-gray-500 font-bold">All Languages</div>
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => handleSelectLanguage(lang)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-[#2D2D2D] transition-colors border-b border-[#2D2D2D]/50 last:border-0"
                                        >
                                            <span className={lang === speakingLanguage ? 'text-blue-400 font-medium' : 'text-gray-200'}>
                                                {lang}
                                            </span>
                                            {lang === speakingLanguage && (
                                                <Check className="w-5 h-5 text-blue-400" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* VIEW: TRANSLATION LANGUAGE SELECTOR */}
                        {view === 'translation' && (
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="flex items-center justify-between p-4 border-b border-[#333]">
                                    <button
                                        onClick={() => setView('main')}
                                        className="p-2 hover:bg-[#2D2D2D] rounded-full"
                                    >
                                        <ChevronLeft className="w-6 h-6" />
                                    </button>
                                    <h2 className="text-xl font-bold">Translate to</h2>
                                    <button
                                        onClick={handleSave}
                                        className="text-white bg-blue-600 font-bold px-4 py-1.5 rounded-lg hover:bg-blue-500 transition-all"
                                    >
                                        Save
                                    </button>
                                </div>

                                <div className="overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                                    <button
                                        onClick={() => setTranslationLanguage('Original')}
                                        className="w-full flex items-center justify-between p-4 hover:bg-[#2D2D2D] transition-colors border-b border-[#2D2D2D]/50"
                                    >
                                        <span className={translationLanguage === 'Original' ? 'text-blue-400 font-medium' : 'text-gray-200'}>
                                            Original (No Translation)
                                        </span>
                                        {translationLanguage === 'Original' && (
                                            <Check className="w-5 h-5 text-blue-400" />
                                        )}
                                    </button>
                                    {LANGUAGES.map((lang) => (
                                        <button
                                            key={lang}
                                            onClick={() => setTranslationLanguage(lang)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-[#2D2D2D] transition-colors border-b border-[#2D2D2D]/50 last:border-0"
                                        >
                                            <span className={lang === translationLanguage ? 'text-blue-400 font-medium' : 'text-gray-200'}>
                                                {lang}
                                            </span>
                                            {lang === translationLanguage && (
                                                <Check className="w-5 h-5 text-blue-400" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
