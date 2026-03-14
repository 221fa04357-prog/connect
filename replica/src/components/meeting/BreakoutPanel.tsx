import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Plus, Play, StopCircle, Trash2, ArrowRight } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { useBreakoutStore, BreakoutRoom } from '@/stores/useBreakoutStore';
import { useParticipantsStore } from '@/stores/useParticipantsStore';
import { useMeetingStore } from '@/stores/useMeetingStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function BreakoutPanel() {
    const { 
        isBreakoutActive, 
        rooms, 
        currentRoomId, 
        createRooms, 
        closeRooms, 
        joinRoom, 
        leaveRoom 
    } = useBreakoutStore();
    const { participants } = useParticipantsStore();
    const { meeting, isJoinedAsHost } = useMeetingStore();
    
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [roomCount, setRoomCount] = useState(2);
    const [stagingRooms, setStagingRooms] = useState<BreakoutRoom[]>([]);
    const [isConfiguring, setIsConfiguring] = useState(false);

    const generateRooms = () => {
        const newRooms: BreakoutRoom[] = [];
        const participantIds = participants.filter(p => p.role !== 'host').map(p => p.id);
        
        // Simple random assignment
        const shuffled = [...participantIds].sort(() => 0.5 - Math.random());
        
        for (let i = 0; i < roomCount; i++) {
            newRooms.push({
                id: `room-${i}-${Date.now()}`,
                name: `Room ${i + 1}`,
                participants: []
            });
        }
        
        shuffled.forEach((id, index) => {
            newRooms[index % roomCount].participants.push(id);
        });
        
        setStagingRooms(newRooms);
        setIsConfiguring(true);
    };

    const handleStartBreakout = () => {
        if (meeting?.id) {
            createRooms(meeting.id, stagingRooms);
            setIsConfiguring(false);
            setIsPanelOpen(false);
        }
    };

    const handleStopBreakout = () => {
        if (meeting?.id) {
            closeRooms(meeting.id);
        }
    };

    if (!isJoinedAsHost && !isBreakoutActive) return null;

    return (
        <>
            {/* Global Banner for Breakout Mode */}
            <AnimatePresence>
                {isBreakoutActive && (
                    <motion.div 
                        initial={{ y: -50 }}
                        animate={{ y: 0 }}
                        exit={{ y: -50 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] bg-blue-600/90 backdrop-blur-md px-6 py-2 rounded-full border border-blue-400 shadow-xl flex items-center gap-4 text-white"
                    >
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {currentRoomId ? `You are in ${rooms.find(r => r.id === currentRoomId)?.name}` : 'Breakout rooms are active'}
                            </span>
                        </div>
                        {currentRoomId ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs bg-white/10 border-white/20 hover:bg-white/20" onClick={() => meeting?.id && leaveRoom(meeting.id, currentRoomId)}>
                                Leave Room
                            </Button>
                        ) : (
                            isJoinedAsHost && (
                                <Button size="sm" variant="outline" className="h-7 text-xs bg-red-500/20 border-red-500/30 hover:bg-red-500/40" onClick={handleStopBreakout}>
                                    End All
                                </Button>
                            )
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Host Control Button (Floating for now) */}
            {isJoinedAsHost && (
                <div className="fixed bottom-24 right-4 z-[60]">
                    <Button 
                        onClick={() => setIsPanelOpen(true)}
                        className={cn(
                            "rounded-full w-14 h-14 shadow-2xl transition-all duration-300",
                            isBreakoutActive ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                        )}
                    >
                        <Users className="w-6 h-6" />
                    </Button>
                </div>
            )}

            {/* Breakout Config Panel */}
            <AnimatePresence>
                {isPanelOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    >
                        <div className="bg-[#1C1C1C] border border-[#404040] rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh] shadow-2xl">
                            <div className="p-4 border-b border-[#404040] flex items-center justify-between">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <Users className="w-6 h-6 text-blue-400" />
                                    Breakout Rooms
                                </h3>
                                <Button variant="ghost" size="icon" onClick={() => setIsPanelOpen(false)}>
                                    <X className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {!isConfiguring ? (
                                    <div className="space-y-6">
                                        <div className="bg-[#252525] p-6 rounded-2xl space-y-4">
                                            <p className="text-gray-400 text-sm">Create small groups for focused collaboration. Participants will be assigned to separate video rooms.</p>
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1">
                                                    <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Number of Rooms</label>
                                                    <Input 
                                                        type="number" 
                                                        min={2} 
                                                        max={10} 
                                                        value={roomCount}
                                                        onChange={(e) => setRoomCount(Number(e.target.value))}
                                                        className="bg-[#1A1A1A] border-[#333]"
                                                    />
                                                </div>
                                                <div className="pt-5">
                                                    <Button onClick={generateRooms} className="bg-blue-600 hover:bg-blue-700">Assign Automatically</Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-400">{stagingRooms.length} Rooms Configured</span>
                                            <Button variant="ghost" size="sm" className="text-blue-400 h-7" onClick={() => setIsConfiguring(false)}>Reset</Button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            {stagingRooms.map((room, idx) => (
                                                <div key={idx} className="bg-[#252525] p-4 rounded-xl border border-[#333] space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-blue-400">{room.name}</span>
                                                        <span className="text-[10px] bg-[#1A1A1A] px-2 py-0.5 rounded text-gray-500 capitalize">{room.participants.length} members</span>
                                                    </div>
                                                    <div className="space-y-1">
                                                        {room.participants.map(pid => {
                                                            const p = participants.find(part => part.id === pid);
                                                            return <div key={pid} className="text-xs text-gray-400 flex items-center gap-2">
                                                                <div className="w-1 h-1 bg-blue-500 rounded-full" />
                                                                {p?.name || 'Guest'}
                                                            </div>;
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 border-t border-[#404040] bg-[#232323] flex justify-end gap-3">
                                <Button variant="ghost" onClick={() => setIsPanelOpen(false)}>Cancel</Button>
                                {isConfiguring && (
                                    <Button onClick={handleStartBreakout} className="bg-green-600 hover:bg-green-700 gap-2">
                                        <Play className="w-4 h-4" /> Start Rooms
                                    </Button>
                                )}
                                {isBreakoutActive && (
                                    <Button onClick={handleStopBreakout} variant="destructive" className="gap-2">
                                        <StopCircle className="w-4 h-4" /> Close All Rooms
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
