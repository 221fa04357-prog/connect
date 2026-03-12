import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wifi, WifiOff, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PeerStats {
    peerId: string;
    // Inbound
    audioPacketsReceived: number;
    audioPacketsLost: number;
    audioJitter: number;
    audioDecodeTime: number;
    videoPacketsReceived: number;
    videoPacketsLost: number;
    videoFrameWidth: number;
    videoFrameHeight: number;
    videoFramesPerSecond: number;
    videoJitter: number;
    // Outbound
    audioPacketsSent: number;
    audioBytesSent: number;
    videoPacketsSent: number;
    videoBytesSent: number;
    videoEncoderImplementation: string;
    // Transport
    roundTripTime: number;
    availableOutgoingBitrate: number;
    availableIncomingBitrate: number;
}

interface MeetingStatsProps {
    isOpen: boolean;
    onClose: () => void;
    peerConnections: React.MutableRefObject<Record<string, RTCPeerConnection>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MeetingStats({ isOpen, onClose, peerConnections }: MeetingStatsProps) {
    const [statsMap, setStatsMap] = useState<Record<string, PeerStats>>({});
    const [expandedPeers, setExpandedPeers] = useState<Record<string, boolean>>({});
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const collectStats = async () => {
        const entries = Object.entries(peerConnections.current);
        if (!entries.length) return;

        const newStats: Record<string, PeerStats> = {};

        for (const [peerId, pc] of entries) {
            try {
                const report = await pc.getStats();
                const ps: PeerStats = {
                    peerId,
                    audioPacketsReceived: 0,
                    audioPacketsLost: 0,
                    audioJitter: 0,
                    audioDecodeTime: 0,
                    videoPacketsReceived: 0,
                    videoPacketsLost: 0,
                    videoFrameWidth: 0,
                    videoFrameHeight: 0,
                    videoFramesPerSecond: 0,
                    videoJitter: 0,
                    audioPacketsSent: 0,
                    audioBytesSent: 0,
                    videoPacketsSent: 0,
                    videoBytesSent: 0,
                    videoEncoderImplementation: '',
                    roundTripTime: 0,
                    availableOutgoingBitrate: 0,
                    availableIncomingBitrate: 0,
                };

                report.forEach((stat) => {
                    switch (stat.type) {
                        case 'inbound-rtp':
                            if (stat.kind === 'audio') {
                                ps.audioPacketsReceived = stat.packetsReceived ?? 0;
                                ps.audioPacketsLost = stat.packetsLost ?? 0;
                                ps.audioJitter = stat.jitter ?? 0;
                                ps.audioDecodeTime = stat.totalDecodeTime ?? 0;
                            } else if (stat.kind === 'video') {
                                ps.videoPacketsReceived = stat.packetsReceived ?? 0;
                                ps.videoPacketsLost = stat.packetsLost ?? 0;
                                ps.videoFrameWidth = stat.frameWidth ?? 0;
                                ps.videoFrameHeight = stat.frameHeight ?? 0;
                                ps.videoFramesPerSecond = stat.framesPerSecond ?? 0;
                                ps.videoJitter = stat.jitter ?? 0;
                            }
                            break;
                        case 'outbound-rtp':
                            if (stat.kind === 'audio') {
                                ps.audioPacketsSent = stat.packetsSent ?? 0;
                                ps.audioBytesSent = stat.bytesSent ?? 0;
                            } else if (stat.kind === 'video') {
                                ps.videoPacketsSent = stat.packetsSent ?? 0;
                                ps.videoBytesSent = stat.bytesSent ?? 0;
                                ps.videoEncoderImplementation = stat.encoderImplementation ?? '';
                            }
                            break;
                        case 'candidate-pair':
                            if (stat.state === 'succeeded' || stat.nominated) {
                                ps.roundTripTime = (stat.currentRoundTripTime ?? 0) * 1000; // ms
                                ps.availableOutgoingBitrate = stat.availableOutgoingBitrate ?? 0;
                                ps.availableIncomingBitrate = stat.availableIncomingBitrate ?? 0;
                            }
                            break;
                    }
                });

                newStats[peerId] = ps;
            } catch {
                // pc may have closed
            }
        }

        setStatsMap(newStats);
    };

    useEffect(() => {
        if (isOpen) {
            collectStats();
            intervalRef.current = setInterval(collectStats, 2000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isOpen]);

    const togglePeer = (id: string) =>
        setExpandedPeers(prev => ({ ...prev, [id]: !prev[id] }));

    const fmtKbps = (bps: number) => bps > 0 ? `${(bps / 1000).toFixed(1)} kbps` : '—';
    const fmtKb = (bytes: number) => bytes > 0 ? `${(bytes / 1024).toFixed(1)} KB` : '—';
    const fmtMs = (ms: number) => ms > 0 ? `${ms.toFixed(1)} ms` : '—';
    const fmtPct = (lost: number, total: number) =>
        total > 0 ? `${((lost / (total + lost)) * 100).toFixed(1)}%` : '0%';

    const qualityColor = (rtt: number) => {
        if (rtt === 0) return 'text-gray-500';
        if (rtt < 80) return 'text-green-400';
        if (rtt < 200) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed right-0 top-0 bottom-20 w-full md:w-80 lg:w-96 bg-[#1C1C1C] border-l border-[#404040] z-30 flex flex-col shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-[#404040] flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-blue-400" />
                            <h3 className="text-lg font-semibold">Meeting Statistics</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-[#2D2D2D] text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {Object.keys(statsMap).length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-500">
                                <WifiOff className="w-10 h-10" />
                                <p className="text-sm">No active connections yet.</p>
                                <p className="text-xs text-center text-gray-600">Stats will appear once other participants join.</p>
                            </div>
                        ) : (
                            Object.entries(statsMap).map(([peerId, ps]) => {
                                const isExpanded = expandedPeers[peerId] ?? true;
                                const lossAudio = fmtPct(ps.audioPacketsLost, ps.audioPacketsReceived);
                                const lossVideo = fmtPct(ps.videoPacketsLost, ps.videoPacketsReceived);

                                return (
                                    <div key={peerId} className="bg-[#232323] border border-[#333] rounded-xl overflow-hidden">
                                        {/* Peer header */}
                                        <button
                                            className="w-full flex items-center justify-between p-3 hover:bg-[#2A2A2A] transition-colors"
                                            onClick={() => togglePeer(peerId)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Wifi className={cn('w-4 h-4', qualityColor(ps.roundTripTime))} />
                                                <span className="text-xs font-mono text-gray-300 truncate max-w-[180px]">
                                                    {peerId.length > 20 ? peerId.slice(0, 8) + '…' + peerId.slice(-6) : peerId}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={cn('text-xs font-medium', qualityColor(ps.roundTripTime))}>
                                                    {ps.roundTripTime > 0 ? `${ps.roundTripTime.toFixed(0)} ms` : '—'}
                                                </span>
                                                {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="p-3 pt-0 border-t border-[#333] grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                                                {/* ── Inbound Audio ── */}
                                                <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider pt-2">
                                                    ▼ Inbound Audio
                                                </div>
                                                <StatRow label="Pkts recv" value={ps.audioPacketsReceived.toString()} />
                                                <StatRow label="Jitter" value={`${(ps.audioJitter * 1000).toFixed(1)} ms`} />
                                                <StatRow label="Lost" value={lossAudio} highlight={ps.audioPacketsLost > 0} />

                                                {/* ── Inbound Video ── */}
                                                <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider pt-1">
                                                    ▼ Inbound Video
                                                </div>
                                                <StatRow label="Resolution" value={ps.videoFrameWidth > 0 ? `${ps.videoFrameWidth}×${ps.videoFrameHeight}` : '—'} />
                                                <StatRow label="FPS" value={ps.videoFramesPerSecond > 0 ? ps.videoFramesPerSecond.toFixed(1) : '—'} />
                                                <StatRow label="Jitter" value={`${(ps.videoJitter * 1000).toFixed(1)} ms`} />
                                                <StatRow label="Lost" value={lossVideo} highlight={ps.videoPacketsLost > 0} />

                                                {/* ── Outbound ── */}
                                                <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider pt-1">
                                                    ▲ Outbound
                                                </div>
                                                <StatRow label="Audio sent" value={fmtKb(ps.audioBytesSent)} />
                                                <StatRow label="Video sent" value={fmtKb(ps.videoBytesSent)} />
                                                {ps.videoEncoderImplementation && (
                                                    <StatRow label="Encoder" value={ps.videoEncoderImplementation} cols={2} />
                                                )}

                                                {/* ── Transport ── */}
                                                <div className="col-span-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider pt-1">
                                                    ⇅ Transport
                                                </div>
                                                <StatRow label="RTT" value={fmtMs(ps.roundTripTime)} />
                                                <StatRow label="Out bw" value={fmtKbps(ps.availableOutgoingBitrate)} />
                                                <StatRow label="In bw" value={fmtKbps(ps.availableIncomingBitrate)} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-[#404040] flex-shrink-0">
                        <p className="text-[10px] text-gray-600 text-center">Updates every 2 seconds</p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function StatRow({ label, value, highlight = false, cols = 1 }: {
    label: string;
    value: string;
    highlight?: boolean;
    cols?: 1 | 2;
}) {
    return (
        <div className={cn('flex flex-col', cols === 2 && 'col-span-2')}>
            <span className="text-gray-600">{label}</span>
            <span className={cn('font-mono font-medium text-gray-200', highlight && 'text-red-400')}>
                {value}
            </span>
        </div>
    );
}
