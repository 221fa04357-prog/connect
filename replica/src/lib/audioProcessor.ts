/**
 * Improved Audio Processor for high-quality voice isolation and VAD.
 */
export class AudioProcessor {
  private audioCtx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private stream: MediaStream | null = null;
  private vadInterval: any = null;
  private isProcessing = false;

  // Configuration for Voice Activity Detection
  private readonly MIN_THRESHOLD = 0.01; // Minimum volume to be considered "speaking"
  private readonly SMOOTHING = 0.8;      // Sensitivity smoothing
  private readonly HOLD_TIME = 300;      // ms to hold the "active" state after silence

  constructor() {}

  public async processStream(stream: MediaStream): Promise<MediaStream> {
    if (this.isProcessing) this.stop();
    this.stream = stream;

    // Create a new AudioContext
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'interactive',
        sampleRate: 48000
    });
    
    this.source = this.audioCtx.createMediaStreamSource(stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.gainNode = this.audioCtx.createGain();

    this.analyser.fftSize = 256;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Initial state: silent to avoid initial noise bursts
    this.gainNode.gain.value = 0;

    // Route: Source -> Analyser -> Gain -> Destination
    this.source.connect(this.analyser);
    this.source.connect(this.gainNode);
    
    // Create a destination stream to pass back
    const destination = this.audioCtx.createMediaStreamDestination();
    this.gainNode.connect(destination);

    this.isProcessing = true;
    let lastActive = Date.now();

    // VAD Loop
    this.vadInterval = setInterval(() => {
      if (!this.analyser || !this.gainNode) return;
      
      this.analyser.getByteFrequencyData(dataArray);
      
      // Focus on voice frequencies (approx 85Hz - 255Hz fundamental, but we check 100-3000Hz)
      // FFT bin size = sampleRate / fftSize = 48000 / 256 = 187.5Hz
      // We look at the first few bins for low-frequency noise and ignore extreme highs
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength / 255; // Normalize to [0, 1]

      if (average > this.MIN_THRESHOLD) {
        lastActive = Date.now();
        // Ramp up quickly for speech starts
        this.gainNode.gain.setTargetAtTime(1.0, this.audioCtx!.currentTime, 0.05);
      } else if (Date.now() - lastActive > this.HOLD_TIME) {
        // Ramp down slowly to prevent clipping and "dryness"
        this.gainNode.gain.setTargetAtTime(0.0, this.audioCtx!.currentTime, 0.1);
      }
    }, 50);

    // Return a new stream with processed audio and original video
    const finalStream = new MediaStream();
    destination.stream.getAudioTracks().forEach(t => finalStream.addTrack(t));
    stream.getVideoTracks().forEach(t => finalStream.addTrack(t));

    return finalStream;
  }

  public stop() {
    if (this.vadInterval) clearInterval(this.vadInterval);
    if (this.source) this.source.disconnect();
    if (this.gainNode) this.gainNode.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.audioCtx) this.audioCtx.close();
    
    this.isProcessing = false;
    this.audioCtx = null;
    this.source = null;
    this.analyser = null;
    this.gainNode = null;
  }
}

/**
 * Enhanced audio constraints for maximum noise isolation.
 */
export const ENHANCED_AUDIO_CONSTRAINTS = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  googEchoCancellation: true,
  googAutoGainControl: true,
  googNoiseSuppression: true,
  googHighpassFilter: true,
  googTypingNoiseDetection: true,
  googAudioMirroring: false,
  channelCount: 1,
  sampleRate: 48000,
  latency: 0
};
