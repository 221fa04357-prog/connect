import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Video, Mic, Monitor, Keyboard, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { useState } from 'react';

export default function SettingsModal() {
    const { isSettingsOpen, toggleSettings } = useMeetingStore();
    const [settings, setSettings] = useState({
        audioInput: 'default',
        audioOutput: 'default',
        videoInput: 'default',
        virtualBackground: 'none',
        backgroundBlur: false,
        hd: true,
        mirrorVideo: true,
        autoMute: false,
        autoVideo: true
    });

    const handleSave = () => {
        toggleSettings();
    };

    if (!isSettingsOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={toggleSettings}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                />

                {/* Modal Content */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative w-full max-w-2xl max-h-[90vh] bg-[#232323] border border-[#404040] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-4 border-b border-[#404040] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Monitor className="w-5 h-5 text-blue-400" />
                            <h2 className="text-xl font-bold">Settings</h2>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleSettings}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>

                    <Tabs defaultValue="audio" className="flex flex-1 min-h-0 overflow-hidden">
                        {/* Sidebar Tabs */}
                        <div className="w-48 border-r border-[#404040] p-2 bg-[#1C1C1C] overflow-y-auto hidden sm:block">
                            <TabsList className="flex flex-col h-auto bg-transparent w-full gap-1">
                                <TabsTrigger
                                    value="audio"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Mic className="w-4 h-4" />
                                    Audio
                                </TabsTrigger>
                                <TabsTrigger
                                    value="video"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Video className="w-4 h-4" />
                                    Video
                                </TabsTrigger>
                                <TabsTrigger
                                    value="general"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Monitor className="w-4 h-4" />
                                    General
                                </TabsTrigger>
                                <TabsTrigger
                                    value="shortcuts"
                                    className="w-full justify-start gap-2 data-[state=active]:bg-[#0B5CFF] data-[state=active]:text-white px-3 py-2 rounded-lg"
                                >
                                    <Keyboard className="w-4 h-4" />
                                    Shortcuts
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Mobile Tabs List (Top Scrollable) */}
                        <div className="sm:hidden border-b border-[#404040] bg-[#1C1C1C] shrink-0 overflow-x-auto no-scrollbar">
                            <TabsList className="flex h-auto bg-transparent p-1 gap-1">
                                <TabsTrigger value="audio" className="flex-1 whitespace-nowrap">Audio</TabsTrigger>
                                <TabsTrigger value="video" className="flex-1 whitespace-nowrap">Video</TabsTrigger>
                                <TabsTrigger value="general" className="flex-1 whitespace-nowrap">General</TabsTrigger>
                                <TabsTrigger value="shortcuts" className="flex-1 whitespace-nowrap">Shortcuts</TabsTrigger>
                            </TabsList>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <TabsContent value="audio" className="p-6 m-0 space-y-6">
                                <div className="space-y-2">
                                    <Label>Microphone</Label>
                                    <Select
                                        value={settings.audioInput}
                                        onValueChange={(value) => setSettings({ ...settings, audioInput: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040]">
                                            <SelectItem value="default">Default Microphone</SelectItem>
                                            <SelectItem value="mic1">Built-in Microphone</SelectItem>
                                            <SelectItem value="mic2">External Microphone</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Speaker</Label>
                                    <Select
                                        value={settings.audioOutput}
                                        onValueChange={(value) => setSettings({ ...settings, audioOutput: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040]">
                                            <SelectItem value="default">Default Speaker</SelectItem>
                                            <SelectItem value="speaker1">Built-in Speaker</SelectItem>
                                            <SelectItem value="speaker2">External Speaker</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <Label htmlFor="autoMute">Mute microphone when joining</Label>
                                    <Switch
                                        id="autoMute"
                                        checked={settings.autoMute}
                                        onCheckedChange={(checked) => setSettings({ ...settings, autoMute: checked })}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="video" className="p-6 m-0 space-y-6">
                                <div className="space-y-2">
                                    <Label>Camera</Label>
                                    <Select
                                        value={settings.videoInput}
                                        onValueChange={(value) => setSettings({ ...settings, videoInput: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040]">
                                            <SelectItem value="default">Default Camera</SelectItem>
                                            <SelectItem value="cam1">Built-in Camera</SelectItem>
                                            <SelectItem value="cam2">External Camera</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Virtual Background</Label>
                                    <Select
                                        value={settings.virtualBackground}
                                        onValueChange={(value) => setSettings({ ...settings, virtualBackground: value })}
                                    >
                                        <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-[#232323] border-[#404040]">
                                            <SelectItem value="none">None</SelectItem>
                                            <SelectItem value="blur">Blur Background</SelectItem>
                                            <SelectItem value="office">Office Background</SelectItem>
                                            <SelectItem value="beach">Beach Background</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between pt-4">
                                    <Label htmlFor="hd">Enable HD Video</Label>
                                    <Switch
                                        id="hd"
                                        checked={settings.hd}
                                        onCheckedChange={(checked) => setSettings({ ...settings, hd: checked })}
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <Label htmlFor="mirrorVideo">Mirror my video</Label>
                                    <Switch
                                        id="mirrorVideo"
                                        checked={settings.mirrorVideo}
                                        onCheckedChange={(checked) => setSettings({ ...settings, mirrorVideo: checked })}
                                    />
                                </div>
                            </TabsContent>

                            <TabsContent value="general" className="p-6 m-0 space-y-6">
                                <div className="space-y-4">
                                    <h3 className="font-semibold text-lg text-white">Meeting Preferences</h3>
                                    <div className="space-y-4">
                                        <div className="p-4 bg-[#1C1C1C] rounded-lg border border-[#404040]">
                                            <p className="text-sm text-gray-400">
                                                These settings will be applied to all your meetings
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Default View Mode</Label>
                                            <Select defaultValue="gallery">
                                                <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-[#232323] border-[#404040]">
                                                    <SelectItem value="gallery">Gallery View</SelectItem>
                                                    <SelectItem value="speaker">Speaker View</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="shortcuts" className="p-6 m-0 space-y-4">
                                <h3 className="font-semibold text-lg text-white mb-2">Shortcuts</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {[
                                        { action: 'Mute/Unmute', shortcut: 'Alt + A' },
                                        { action: 'Video On/Off', shortcut: 'Alt + V' },
                                        { action: 'Share Screen', shortcut: 'Alt + S' },
                                        { action: 'Recording', shortcut: 'Alt + D' },
                                        { action: 'Chat', shortcut: 'Alt + C' },
                                        { action: 'Participants', shortcut: 'Alt + P' },
                                        { action: 'Reactions', shortcut: 'Alt + R' },
                                        { action: 'Raise/Lower Hand', shortcut: 'Alt + H' },
                                        { action: 'Whiteboard', shortcut: 'Alt + W' },
                                        { action: 'AI Companion', shortcut: 'Alt + I' },
                                        { action: 'Toggle View', shortcut: 'Alt + G' },
                                        { action: 'Settings', shortcut: 'Alt + T' },
                                        { action: 'Self View', shortcut: 'Alt + O' },
                                        { action: 'Leave', shortcut: 'Alt + L' }
                                    ].map((item) => (
                                        <div
                                            key={item.action}
                                            className="flex items-center justify-between p-3 bg-[#1C1C1C] rounded-lg border border-[#404040]"
                                        >
                                            <span className="text-[13px] text-gray-300">{item.action}</span>
                                            <kbd className="px-2 py-1 bg-[#232323] border border-[#404040] rounded text-[10px] font-mono text-blue-400 whitespace-nowrap">
                                                {item.shortcut}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    {/* Footer */}
                    <div className="p-4 border-t border-[#404040] flex justify-end gap-3 bg-[#1C1C1C]">
                        <Button
                            variant="ghost"
                            onClick={toggleSettings}
                            className="text-gray-400 hover:text-white"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            className="bg-[#0B5CFF] hover:bg-blue-600 text-white px-6"
                        >
                            Save Changes
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
