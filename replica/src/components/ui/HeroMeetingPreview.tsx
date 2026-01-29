
import { Mic, MicOff, Video, VideoOff, Users, User, MoreHorizontal } from 'lucide-react';

export default function HeroMeetingPreview() {
  const participants = [
    { name: 'Sarah Wilson', active: true, video: true, audio: true, color: 'bg-indigo-500' },
    { name: 'David Chen', active: false, video: true, audio: false, color: 'bg-emerald-500' },
    { name: 'Alex Thompson', active: false, video: true, audio: true, color: 'bg-blue-500' },
    { name: 'Maria Garcia', active: false, video: false, audio: true, color: 'bg-rose-500' },
    { name: 'James Wilson', active: false, video: true, audio: false, color: 'bg-orange-500' },
    { name: 'You', active: false, video: true, audio: true, color: 'bg-gray-700' },
  ];

  return (
    <div className="relative w-full aspect-video bg-[#1C1C1C] rounded-xl shadow-2xl border border-[#333] overflow-hidden p-2 sm:p-4">
      {/* Meeting Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4 h-full relative z-10">
        {participants.map((p, i) => (
          <div key={i} className="relative bg-[#2A2A2A] rounded-lg overflow-hidden flex flex-col items-center justify-center group">
            {p.video ? (
              <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full ${p.color} flex items-center justify-center text-white text-xl sm:text-2xl font-bold mb-2`}>
                {p.name.charAt(0)}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#333] flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
              </div>
            )}
            
            {/* Name Tag */}
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white flex items-center gap-2">
              {p.audio ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3 text-red-500" />}
              <span>{p.name}</span>
            </div>
            
            {/* Active Speaker Border */}
            {p.active && (
              <div className="absolute inset-0 border-2 border-[#0B5CFF] rounded-lg" />
            )}
          </div>
        ))}
      </div>

      {/* Floating Controls Overlay (Decorative) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1C1C1C]/90 backdrop-blur border border-[#333] px-6 py-3 rounded-full flex items-center gap-6 shadow-xl z-20">
        <div className="p-2 rounded-full hover:bg-[#333] text-white cursor-pointer"><Mic className="w-5 h-5" /></div>
        <div className="p-2 rounded-full hover:bg-[#333] text-white cursor-pointer"><Video className="w-5 h-5" /></div>
        <div className="p-2 rounded-full hover:bg-[#333] text-[#0B5CFF] cursor-pointer"><Users className="w-5 h-5" /></div>
        <div className="bg-[#FF443B] text-white px-4 py-1.5 rounded-lg text-sm font-medium cursor-pointer">End</div>
      </div>
    </div>
  );
}
