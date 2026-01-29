import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Video, Mic, MicOff, VideoOff, Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/useAuthStore';

export function JoinMeeting() {
    const navigate = useNavigate();
    const [meetingId, setMeetingId] = useState('');
    const [name, setName] = useState('');
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const handleJoin = () => {
        if (!meetingId || !name) {
            alert('Please enter meeting ID and your name');
            return;
        }
        navigate('/meeting');
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
        date: '',
        time: '',
        duration: '60',
        waitingRoom: true,
        muteOnEntry: false,
        requirePassword: false,
        password: ''
    });

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

                    <div className="flex gap-4 mb-8">
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
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            id="date"
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="bg-[#1C1C1C] border-[#404040] pl-10"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="time">Time</Label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            id="time"
                                            type="time"
                                            value={formData.time}
                                            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            className="bg-[#1C1C1C] border-[#404040] pl-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="duration">Duration (minutes)</Label>
                                <Input
                                    id="duration"
                                    type="number"
                                    value={formData.duration}
                                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                    className="bg-[#1C1C1C] border-[#404040]"
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
