import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Video, Mic, MicOff, VideoOff, Calendar, Clock } from 'lucide-react';
// Helper for generating days in a month
function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

// Helper for formatting date
function formatDate(date: Date | null) {
    if (!date) return '';
    const d = date;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
}

// Helper for formatting time
function formatTime(date: Date | null) {
    if (!date) return '';
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';
import { useGuestSessionStore } from '@/stores/useGuestSessionStore';

export function JoinMeeting() {
    const navigate = useNavigate();
    const [meetingId, setMeetingId] = useState('');
    const [name, setName] = useState('');
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const guestSessionActive = useGuestSessionStore((state) => state.guestSessionActive);

    const handleJoin = () => {
        if (!meetingId || !name) {
            alert('Please enter meeting ID and your name');
            return;
        }
        // Allow join if authenticated or guest session is active
        if (isAuthenticated || guestSessionActive) {
            navigate('/meeting');
        } else {
            alert('Guest session expired. Please sign in to continue.');
            navigate('/login');
        }
    };

    return (
        <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl"
            >
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-[#232323] rounded-2xl p-6 flex flex-col">
                        <h3 className="text-xl font-semibold mb-4">Preview</h3>

                        <div className="flex-1 bg-[#1C1C1C] rounded-lg relative overflow-hidden mb-4">
                            {isVideoOff ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-24 h-24 rounded-full bg-[#0B5CFF] flex items-center justify-center text-white text-3xl font-semibold">
                                        {name ? name.charAt(0).toUpperCase() : 'Y'}
                                    </div>
                                </div>
                            ) : (
                                <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                    <Video className="w-16 h-16 text-gray-500" />
                                </div>
                            )}
                        </div>

                        <div className="flex justify-center gap-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsAudioMuted(!isAudioMuted)}
                                className={cn(
                                    'rounded-full w-12 h-12',
                                    isAudioMuted ? 'bg-red-500 hover:bg-red-600' : 'hover:bg-[#2D2D2D]'
                                )}
                            >
                                {isAudioMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </Button>

                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsVideoOff(!isVideoOff)}
                                className={cn(
                                    'rounded-full w-12 h-12',
                                    isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'hover:bg-[#2D2D2D]'
                                )}
                            >
                                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                            </Button>
                        </div>
                    </div>

                    <div className="bg-[#232323] rounded-2xl p-8 flex flex-col justify-center">
                        <h2 className="text-3xl font-bold mb-2">Join Meeting</h2>
                        <p className="text-gray-400 mb-8">
                            Enter the meeting ID to join
                        </p>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="meetingId">Meeting ID</Label>
                                <Input
                                    id="meetingId"
                                    type="text"
                                    placeholder="123-456-789"
                                    value={meetingId}
                                    onChange={(e) => setMeetingId(e.target.value)}
                                    className="bg-[#1C1C1C] border-[#404040] text-lg"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Your Name</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-[#1C1C1C] border-[#404040] text-lg"
                                />
                            </div>

                            <Button
                                onClick={handleJoin}
                                className="w-full bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white py-6 text-lg"
                            >
                                Join Meeting
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => navigate('/')}
                                className="w-full"
                            >
                                Back to Home
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

export function CreateMeeting() {
    const navigate = useNavigate();
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const user = useAuthStore((state) => state.user);
    const [isScheduled, setIsScheduled] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        date: '', // yyyy-mm-dd
        time: '', // HH:mm
        duration: '', // allow empty/null
        waitingRoom: true,
        muteOnEntry: false,
        requirePassword: false,
        password: ''
    });

    // Popover state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [timePickerHour, setTimePickerHour] = useState<string | null>(null); // for two-step selection
    const dateInputRef = useRef<HTMLInputElement>(null);
    const timeInputRef = useRef<HTMLInputElement>(null);

    // Autofill detection for date/time
    // When browser autofills, input event is fired with isTrusted true, but sometimes only animationstart is reliable
    // We'll use both for robustness
    const handleDateAutofill = (e: React.SyntheticEvent<HTMLInputElement>) => {
        // If value is filled and popup is open, close it
        if (e.currentTarget.value && showDatePicker) {
            setShowDatePicker(false);
        }
    };
    const handleTimeAutofill = (e: React.SyntheticEvent<HTMLInputElement>) => {
        if (e.currentTarget.value && showTimePicker) {
            setShowTimePicker(false);
        }
    };

    // For date picker
    const today = new Date();
    const selectedDate = formData.date ? new Date(formData.date) : null;
    const [pickerMonth, setPickerMonth] = useState(today.getMonth());
    const [pickerYear, setPickerYear] = useState(today.getFullYear());
    const [pickerView, setPickerView] = useState<'day' | 'month' | 'year'>('day');
    const [yearScroll, setYearScroll] = useState(0); // for scrolling years

    // For time picker
    const selectedTime = formData.time;

    // Redirect to login if not authenticated
    if (!isAuthenticated) {
        navigate('/login', { replace: true });
        return null;
    }

    const handleCreate = () => {
        if (isScheduled && (!formData.title || !formData.date || !formData.time)) {
            alert('Please fill in all required fields');
            return;
        }
        navigate('/meeting');
    };

    const handleInstantMeeting = () => {
        // Store current user info in meeting context
        navigate('/meeting');
    };

    return (
        <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-2xl"
            >
                <div className="bg-[#232323] rounded-2xl p-8">
                    <div className="flex items-center gap-3 mb-8">
                        <Video className="w-8 h-8 text-[#0B5CFF]" />
                        <h2 className="text-3xl font-bold">Create Meeting</h2>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mb-8">
                        <Button
                            onClick={() => setIsScheduled(false)}
                            variant={!isScheduled ? 'default' : 'outline'}
                            className={!isScheduled ? 'bg-[#0B5CFF]' : 'border-[#404040]'}
                        >
                            Instant Meeting
                        </Button>
                        <Button
                            onClick={() => setIsScheduled(true)}
                            variant={isScheduled ? 'default' : 'outline'}
                            className={isScheduled ? 'bg-[#0B5CFF]' : 'border-[#404040]'}
                        >
                            Schedule Meeting
                        </Button>
                    </div>

                    {isScheduled ? (
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="title">Meeting Title</Label>
                                <Input
                                    id="title"
                                    type="text"
                                    placeholder="Team Standup"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="bg-[#1C1C1C] border-[#404040]"
                                />
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">

                                <div className="space-y-2">
                                    <Label htmlFor="date">Date</Label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10"
                                            onClick={() => setShowDatePicker((v) => !v)}
                                        >
                                            <Calendar />
                                        </button>
                                        <Input
                                            id="date"
                                            ref={dateInputRef}
                                            type="text"
                                            placeholder="dd-mm-yyyy"
                                            value={formData.date ? formData.date.split('-').reverse().join('-') : ''}
                                            onChange={(e) => {
                                                // Accept manual typing in dd-mm-yyyy or yyyy-mm-dd
                                                let val = e.target.value;
                                                // Try to convert dd-mm-yyyy to yyyy-mm-dd
                                                if (/^\d{2}-\d{2}-\d{4}$/.test(val)) {
                                                    const [d, m, y] = val.split('-');
                                                    val = `${y}-${m}-${d}`;
                                                }
                                                setFormData({ ...formData, date: val });
                                            }}
                                            onInput={handleDateAutofill}
                                            onAnimationStart={handleDateAutofill}
                                            className="bg-[#1C1C1C] border-[#404040] pl-10"
                                        />
                                        {/* Date Picker Popover */}
                                        {showDatePicker && (
                                            <div className="absolute left-0 mt-2 z-20 bg-[#232323] border border-[#404040] rounded-lg shadow-lg p-4" style={{ minWidth: 260, width: 320 }}>
                                                {/* Header with navigation and view switch */}
                                                <div className="flex items-center justify-between mb-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (pickerView === 'day') {
                                                                setPickerYear(y => y - (pickerMonth === 0 ? 1 : 0));
                                                                setPickerMonth(m => m === 0 ? 11 : m - 1);
                                                            } else if (pickerView === 'month') {
                                                                setPickerYear(y => y - 1);
                                                            } else if (pickerView === 'year') {
                                                                setYearScroll(s => s - 12);
                                                            }
                                                        }}
                                                        className="px-2"
                                                    >&#8592;</button>
                                                    <span
                                                        className="font-semibold cursor-pointer select-none"
                                                        onClick={() => setPickerView(v => v === 'day' ? 'month' : v === 'month' ? 'year' : 'day')}
                                                    >
                                                        {pickerView === 'day' && (
                                                            <>
                                                                {new Date(pickerYear, pickerMonth).toLocaleString('default', { month: 'long' })} {pickerYear}
                                                            </>
                                                        )}
                                                        {pickerView === 'month' && (
                                                            <>{pickerYear}</>
                                                        )}
                                                        {pickerView === 'year' && (
                                                            <>{pickerYear + yearScroll}</>
                                                        )}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (pickerView === 'day') {
                                                                setPickerYear(y => y + (pickerMonth === 11 ? 1 : 0));
                                                                setPickerMonth(m => m === 11 ? 0 : m + 1);
                                                            } else if (pickerView === 'month') {
                                                                setPickerYear(y => y + 1);
                                                            } else if (pickerView === 'year') {
                                                                setYearScroll(s => s + 12);
                                                            }
                                                        }}
                                                        className="px-2"
                                                    >&#8594;</button>
                                                </div>
                                                {/* Views */}
                                                {pickerView === 'day' && (
                                                    <>
                                                        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
                                                            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="font-bold">{d}</div>)}
                                                        </div>
                                                        <div className="grid grid-cols-7 gap-1 text-center">
                                                            {(() => {
                                                                const firstDay = new Date(pickerYear, pickerMonth, 1).getDay();
                                                                const days = getDaysInMonth(pickerYear, pickerMonth);
                                                                const blanks = Array(firstDay).fill(null);
                                                                return [
                                                                    ...blanks.map((_, i) => <div key={"b"+i}></div>),
                                                                    ...Array(days).fill(0).map((_, i) => {
                                                                        const d = i + 1;
                                                                        const isSelected = selectedDate && selectedDate.getFullYear() === pickerYear && selectedDate.getMonth() === pickerMonth && selectedDate.getDate() === d;
                                                                        return (
                                                                            <button
                                                                                key={d}
                                                                                className={
                                                                                    "w-8 h-8 rounded-full "+
                                                                                    (isSelected ? "bg-[#0B5CFF] text-white" : "hover:bg-[#404040]")
                                                                                }
                                                                                onClick={() => {
                                                                                    const date = new Date(pickerYear, pickerMonth, d);
                                                                                    setFormData({ ...formData, date: formatDate(date) });
                                                                                    setShowDatePicker(false);
                                                                                    setPickerView('day');
                                                                                }}
                                                                            >
                                                                                {d}
                                                                            </button>
                                                                        );
                                                                    })
                                                                ];
                                                            })()}
                                                        </div>
                                                    </>
                                                )}
                                                {pickerView === 'month' && (
                                                    <div className="grid grid-cols-4 gap-2 text-center mb-2">
                                                        {Array.from({ length: 12 }).map((_, m) => {
                                                            const isSelected = pickerMonth === m;
                                                            return (
                                                                <button
                                                                    key={m}
                                                                    className={
                                                                        "py-1 px-2 rounded "+
                                                                        (isSelected ? "bg-[#0B5CFF] text-white" : "hover:bg-[#404040]")
                                                                    }
                                                                    onClick={() => {
                                                                        setPickerMonth(m);
                                                                        setPickerView('day');
                                                                    }}
                                                                >
                                                                    {new Date(2000, m).toLocaleString('default', { month: 'short' })}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {pickerView === 'year' && (
                                                    <div className="max-h-40 overflow-y-auto mb-2">
                                                        {Array.from({ length: 12 }).map((_, i) => {
                                                            const year = pickerYear + yearScroll - 6 + i;
                                                            const isSelected = pickerYear === year;
                                                            return (
                                                                <button
                                                                    key={year}
                                                                    className={
                                                                        "block w-full text-left py-1 px-2 rounded "+
                                                                        (isSelected ? "bg-[#0B5CFF] text-white" : "hover:bg-[#404040]")
                                                                    }
                                                                    onClick={() => {
                                                                        setPickerYear(year);
                                                                        setPickerView('month');
                                                                    }}
                                                                >
                                                                    {year}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                <div className="flex justify-between mt-2">
                                                    <button type="button" className="text-xs text-gray-400 hover:underline" onClick={() => { setFormData({ ...formData, date: '' }); setShowDatePicker(false); setPickerView('day'); }}>Clear</button>
                                                    <button type="button" className="text-xs text-gray-400 hover:underline" onClick={() => { setFormData({ ...formData, date: formatDate(today) }); setShowDatePicker(false); setPickerMonth(today.getMonth()); setPickerYear(today.getFullYear()); setPickerView('day'); }}>Today</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="time">Time</Label>
                                    <div className="relative">
                                        <button
                                            type="button"
                                            tabIndex={-1}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10"
                                            onClick={() => {
                                                setShowTimePicker((v) => !v);
                                                setTimePickerHour(null);
                                            }}
                                        >
                                            <Clock />
                                        </button>
                                        <Input
                                            id="time"
                                            ref={timeInputRef}
                                            type="text"
                                            placeholder="--:--"
                                            value={formData.time}
                                            onChange={(e) => {
                                                setFormData({ ...formData, time: e.target.value });
                                            }}
                                            onInput={handleTimeAutofill}
                                            onAnimationStart={handleTimeAutofill}
                                            className="bg-[#1C1C1C] border-[#404040] pl-10"
                                        />
                                        {/* Time Picker Popover */}
                                        {showTimePicker && (
                                            <div className="absolute left-0 mt-2 z-20 bg-[#232323] border border-[#404040] rounded-lg shadow-lg flex" style={{ minWidth: 120 }}>
                                                {/* Hour column */}
                                                <div className="max-h-48 overflow-y-auto">
                                                    {Array.from({ length: 24 }).map((_, h) => {
                                                        const hourStr = String(h).padStart(2, '0');
                                                        const isSelected = timePickerHour === hourStr || (formData.time && formData.time.split(':')[0] === hourStr && timePickerHour === null);
                                                        return (
                                                            <div key={h} className="flex">
                                                                <button
                                                                    className={
                                                                        "w-12 h-8 text-left px-2 rounded-none "+
                                                                        (isSelected ? "bg-[#E5E5E5] text-black font-bold" : "hover:bg-[#404040]")
                                                                    }
                                                                    style={{border:'none'}}
                                                                    onClick={() => {
                                                                        setTimePickerHour(hourStr);
                                                                    }}
                                                                >{hourStr}</button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                {/* Minute column */}
                                                <div className="max-h-48 overflow-y-auto">
                                                    {Array.from({ length: 60 }).map((_, m) => {
                                                        const minStr = String(m).padStart(2, '0');
                                                        const isSelected = timePickerHour !== null
                                                            ? (formData.time === `${timePickerHour}:${minStr}`)
                                                            : (formData.time && formData.time.split(':')[1] === minStr);
                                                        return (
                                                            <div key={m} className="flex">
                                                                <button
                                                                    className={
                                                                        "w-12 h-8 text-left px-2 rounded-none "+
                                                                        (isSelected ? "bg-[#E5E5E5] text-black font-bold" : "hover:bg-[#404040]")
                                                                    }
                                                                    style={{border:'none'}}
                                                                    onClick={() => {
                                                                        const hour = timePickerHour !== null ? timePickerHour : (formData.time.split(':')[0] || '00');
                                                                        setFormData({ ...formData, time: `${hour}:${minStr}` });
                                                                        setShowTimePicker(false);
                                                                        setTimePickerHour(null);
                                                                    }}
                                                                >{minStr}</button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="duration">Duration (minutes)</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    min={1}
                                    max={480}
                                    step={1}
                                    value={formData.duration === '' ? '' : formData.duration}
                                    onChange={(e) => {
                                        let val = e.target.value;
                                        if (val === '' || val === null) {
                                            setFormData({ ...formData, duration: '' });
                                        } else {
                                            // Only allow numbers and clamp to min/max
                                            let num = Math.max(1, Math.min(480, Number(val.replace(/[^0-9]/g, ''))));
                                            setFormData({ ...formData, duration: isNaN(num) ? '' : num.toString() });
                                        }
                                    }}
                                    className="bg-[#1C1C1C] border-[#404040] appearance-auto"
                                />
                            </div>

                            <div className="space-y-4 pt-4 border-t border-[#404040]">
                                <h3 className="font-semibold">Meeting Settings</h3>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="waitingRoom" className="cursor-pointer">
                                        Enable Waiting Room
                                    </Label>
                                    <Switch
                                        id="waitingRoom"
                                        checked={formData.waitingRoom}
                                        onCheckedChange={(checked) => setFormData({ ...formData, waitingRoom: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="muteOnEntry" className="cursor-pointer">
                                        Mute Participants on Entry
                                    </Label>
                                    <Switch
                                        id="muteOnEntry"
                                        checked={formData.muteOnEntry}
                                        onCheckedChange={(checked) => setFormData({ ...formData, muteOnEntry: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="requirePassword" className="cursor-pointer">
                                        Require Meeting Password
                                    </Label>
                                    <Switch
                                        id="requirePassword"
                                        checked={formData.requirePassword}
                                        onCheckedChange={(checked) => setFormData({ ...formData, requirePassword: checked })}
                                    />
                                </div>

                                {formData.requirePassword && (
                                    <div className="space-y-2">
                                        <Label htmlFor="password">Meeting Password</Label>
                                        <Input
                                            id="password"
                                            type="text"
                                            placeholder="Enter password"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            className="bg-[#1C1C1C] border-[#404040]"
                                        />
                                    </div>
                                )}
                            </div>

                            <Button
                                onClick={handleCreate}
                                className="w-full bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white py-6 text-lg"
                            >
                                Schedule Meeting
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-gray-400 mb-8">
                                Start an instant meeting right now
                            </p>
                            <Button
                                onClick={handleInstantMeeting}
                                className="bg-[#0B5CFF] hover:bg-[#2D8CFF] text-white px-12 py-6 text-lg"
                            >
                                Start Instant Meeting
                            </Button>
                        </div>
                    )}

                    <Button
                        variant="ghost"
                        onClick={() => navigate('/')}
                        className="w-full mt-4"
                    >
                        Back to Home
                    </Button>
                </div>
            </motion.div>
        </div>
    );
}
