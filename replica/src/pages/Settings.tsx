import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { Label } from '@/components/ui';
import { Switch } from '@/components/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { Video, Mic, Monitor, Keyboard, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useMeetingStore } from '@/stores/useMeetingStore';

const API = import.meta.env.VITE_API_URL || '';

export default function Settings() {
  const navigate = useNavigate();
  const {
    audioDevices,
    videoDevices,
    speakerDevices,
    selectedAudioId,
    selectedVideoId,
    selectedSpeakerId,
    enumerateDevices,
    setAudioDevice,
    setVideoDevice,
    setSpeakerDevice
  } = useMeetingStore();

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

  const [loading, setLoading] = useState(false);

  // Enumerate devices on mount
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API}/api/user/settings`, {
          headers: { 'x-user-id': 'default-user' } // Mock auth
        });
        if (res.ok) {
          const data = await res.json();
          // Merge with defaults if data exists
          if (data && Object.keys(data).length > 0) {
            setSettings(prev => ({ ...prev, ...data }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/user/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'default-user'
        },
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        alert('Settings saved successfully!');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Backend might be down.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#1C1C1C] p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto"
      >
        <div className="bg-[#232323] rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-[#404040] flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="hover:bg-[#2D2D2D]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex flex-col">
              <h2 className="text-2xl font-bold">Settings</h2>
            </div>
          </div>

          <Tabs defaultValue="audio" className="p-6">
            <TabsList className="bg-[#1C1C1C] mb-6">
              <TabsTrigger value="audio" className="gap-2">
                <Mic className="w-4 h-4" />
                Audio
              </TabsTrigger>
              <TabsTrigger value="video" className="gap-2">
                <Video className="w-4 h-4" />
                Video
              </TabsTrigger>
              <TabsTrigger value="general" className="gap-2">
                <Monitor className="w-4 h-4" />
                General
              </TabsTrigger>
              <TabsTrigger value="shortcuts" className="gap-2">
                <Keyboard className="w-4 h-4" />
                Shortcuts
              </TabsTrigger>
            </TabsList>

            {/* Audio Settings */}
            <TabsContent value="audio" className="space-y-6">
              <div className="space-y-2">
                <Label>Microphone</Label>
                <Select
                  value={selectedAudioId}
                  onValueChange={(value) => {
                    setSettings({ ...settings, audioInput: value });
                    setAudioDevice(value);
                  }}
                >
                  <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#232323] border-[#404040]">
                    <SelectItem value="default">Default Microphone</SelectItem>
                    {audioDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Speaker</Label>
                <Select
                  value={selectedSpeakerId}
                  onValueChange={(value) => {
                    setSettings({ ...settings, audioOutput: value });
                    setSpeakerDevice(value);
                  }}
                >
                  <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#232323] border-[#404040]">
                    <SelectItem value="default">Default Speaker</SelectItem>
                    {speakerDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                      </SelectItem>
                    ))}
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

            {/* Video Settings */}
            <TabsContent value="video" className="space-y-6">
              <div className="space-y-2">
                <Label>Camera</Label>
                <Select
                  value={selectedVideoId}
                  onValueChange={(value) => {
                    setSettings({ ...settings, videoInput: value });
                    setVideoDevice(value);
                  }}
                >
                  <SelectTrigger className="bg-[#1C1C1C] border-[#404040]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#232323] border-[#404040]">
                    <SelectItem value="default">Default Camera</SelectItem>
                    {videoDevices.map((device) => (
                      <SelectItem key={device.deviceId} value={device.deviceId}>
                        {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                      </SelectItem>
                    ))}
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

              <div className="flex items-center justify-between">
                <Label htmlFor="autoVideo">Start with video on</Label>
                <Switch
                  id="autoVideo"
                  checked={settings.autoVideo}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoVideo: checked })}
                />
              </div>
            </TabsContent>

            {/* General Settings */}
            <TabsContent value="general" className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Meeting Preferences</h3>

                <div className="space-y-4">
                  <div className="p-4 bg-[#1C1C1C] rounded-lg">
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

            <TabsContent value="shortcuts" className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Keyboard Shortcuts</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  { action: 'Leave Meeting', shortcut: 'Alt + L' }
                ].map((item) => (
                  <div
                    key={item.action}
                    className="flex items-center justify-between p-4 bg-[#1C1C1C] rounded-xl border border-[#404040]/50"
                  >
                    <span className="text-sm text-gray-300">{item.action}</span>
                    <kbd className="px-3 py-1 bg-[#232323] border border-[#404040] rounded text-xs font-mono text-blue-400">
                      {item.shortcut}
                    </kbd>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="p-6 border-t border-[#404040] flex justify-end gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#0B5CFF] hover:bg-[#2D8CFF]"
            >
              Save Changes
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
