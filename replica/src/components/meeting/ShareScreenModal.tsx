import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Monitor, Lock } from 'lucide-react';

interface ShareScreenModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export default function ShareScreenModal({ open, onOpenChange, onConfirm }: ShareScreenModalProps) {
    const [sharingKey, setSharingKey] = useState('');
    const [error, setError] = useState('');

    const handleShare = () => {
        if (!sharingKey.trim()) {
            setError('Sharing key or Meeting ID is required');
            return;
        }
        // Simulate validation
        if (sharingKey.length < 6) {
            setError('Invalid sharing key');
            return;
        }

        setError('');
        onConfirm();
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-[#1C1C1C] border-[#333] text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Monitor className="w-5 h-5 text-blue-500" />
                        Share Screen
                    </DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="bg-[#2A2A2A] p-4 rounded-lg flex items-start gap-3">
                        <Lock className="w-5 h-5 text-gray-400 mt-1" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-white">Security Check</p>
                            <p className="text-xs text-gray-400">
                                Please enter the Sharing Key or Meeting ID displayed on the room screen to start sharing.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sharing-key" className="text-gray-300">Sharing Key / Meeting ID</Label>
                        <Input
                            id="sharing-key"
                            placeholder="Enter key..."
                            value={sharingKey}
                            onChange={(e) => {
                                setSharingKey(e.target.value);
                                setError('');
                            }}
                            className="bg-[#232323] border-[#404040] text-white focus:ring-blue-500"
                        />
                        {error && <p className="text-xs text-red-400">{error}</p>}
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="hover:bg-[#333] text-gray-300"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleShare}
                        disabled={!sharingKey.trim()}
                        className="bg-[#0B5CFF] hover:bg-[#0948c7] text-white"
                    >
                        Share Screen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
