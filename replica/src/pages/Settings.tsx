import { useState } from 'react';
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
import { Video, Mic, Monitor, Keyboard, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Settings() {
  const navigate = useNavigate();
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

  // TODO: Connect to backend to save user preferences
  // PUT /api/user/settings
  // Expected payload: settings object
  const handleSave = () => {
    alert('Settings saved successfully!');
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
            <h2 className="text-2xl font-bold">Settings</h2>
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

            {/* Video Settings */}
            <TabsContent value="video" className="space-y-6">
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

            {/* Keyboard Shortcuts */}
            <TabsContent value="shortcuts" className="space-y-4">
              <h3 className="font-semibold text-lg mb-4">Keyboard Shortcuts</h3>
              
              <div className="space-y-3">
                {[
                  { action: 'Mute/Unmute Audio', shortcut: 'Alt + A' },
                  { action: 'Start/Stop Video', shortcut: 'Alt + V' },
                  { action: 'Share Screen', shortcut: 'Alt + S' },
                  { action: 'Open Chat', shortcut: 'Alt + H' },
                  { action: 'Open Participants', shortcut: 'Alt + U' },
                  { action: 'Raise/Lower Hand', shortcut: 'Alt + Y' },
                  { action: 'Leave Meeting', shortcut: 'Alt + Q' }
                ].map((item) => (
                  <div
                    key={item.action}
                    className="flex items-center justify-between p-3 bg-[#1C1C1C] rounded-lg"
                  >
                    <span className="text-sm">{item.action}</span>
                    <kbd className="px-3 py-1 bg-[#232323] border border-[#404040] rounded text-sm font-mono">
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