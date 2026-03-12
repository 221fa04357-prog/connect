/**
 * caption.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone real-time caption system for the NeuralChat webinar application.
 *
 * What this module does
 *   1. Requests microphone access from the browser
 *   2. Uses the Web Audio API to detect whether the user is actually speaking
 *   3. Captures audio in 2-second chunks via MediaRecorder (audio/webm)
 *   4. POSTs each chunk to the FastAPI /transcribe endpoint
 *   5. Renders the returned text in a Zoom-style caption bar at the bottom
 *      centre of the screen
 *   6. Automatically hides the caption bar 3 seconds after speech stops
 *
 * Dependencies
 *   • caption.css  (import in your HTML head)
 *   • FastAPI caption server running on http://localhost:8765
 *
 * Usage
 *   import CaptionSystem from './caption.js';
 *   const captions = new CaptionSystem();
 *   captions.init();                    // call once after DOM is ready
 *   captions.start();                   // start recording + captioning
 *   captions.stop();                    // stop cleanly
 *   captions.destroy();                 // remove DOM nodes and listeners
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** URL of the FastAPI caption server */
const CAPTION_SERVER_URL = '/api/transcribe';

/** How many milliseconds each audio chunk spans (matches MediaRecorder slice) */
const CHUNK_INTERVAL_MS = 2000;

/** How long (ms) to keep the caption visible after the last speech */
const CAPTION_HIDE_DELAY_MS = 3000;

/** Volume threshold (0–255) above which we classify audio as speech */
const SPEECH_VOLUME_THRESHOLD = 15;

/** FFT size used by the analyser node — must be a power of 2 */
const FFT_SIZE = 256;


// ── CaptionSystem class ───────────────────────────────────────────────────────

export default class CaptionSystem {

    constructor(options = {}) {
        /**
         * @param {object}  options
         * @param {string}  [options.serverUrl]        Override the transcribe endpoint
         * @param {number}  [options.chunkIntervalMs]  Override chunk interval
         * @param {number}  [options.hideDelayMs]      Override caption hide delay
         * @param {number}  [options.volumeThreshold]  Override speech detection threshold
         * @param {boolean} [options.showToggleBtn]    Whether to inject a toggle button (default: true)
         * @param {boolean} [options.showStatusBar]    Whether to show the "Captions on" status bar (default: true)
         */
        this.serverUrl = options.serverUrl ?? CAPTION_SERVER_URL;
        this.chunkIntervalMs = options.chunkIntervalMs ?? CHUNK_INTERVAL_MS;
        this.hideDelayMs = options.hideDelayMs ?? CAPTION_HIDE_DELAY_MS;
        this.volumeThreshold = options.volumeThreshold ?? SPEECH_VOLUME_THRESHOLD;
        this.showToggleBtn = options.showToggleBtn ?? true;
        this.showStatusBar = options.showStatusBar ?? true;

        // Internal state
        this._isRunning = false;
        this._isEnabled = false;
        this._stream = null;      // MediaStream
        this._mediaRecorder = null;      // MediaRecorder
        this._audioCtx = null;      // AudioContext
        this._analyser = null;      // AnalyserNode
        this._chunkInterval = null;      // setInterval id
        this._hideTimer = null;      // setTimeout id
        this._rafId = null;      // requestAnimationFrame id
        this._speechInSegment = false;     // was speech detected in current chunk?
        this._pendingRequests = 0;         // in-flight fetches

        // DOM refs
        this._overlayEl = null;
        this._textEl = null;
        this._statusBarEl = null;
        this._toggleBtnEl = null;
    }


    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Inject DOM nodes into the page. Call once after DOMContentLoaded.
     * Safe to call multiple times — subsequent calls are no-ops.
     */
    init() {
        if (this._overlayEl) return; // already initialised

        this._buildDOM();
        console.info('[CaptionSystem] Initialised.');
    }

    /**
     * Request microphone access and start the caption loop.
     * Resolves when recording begins; rejects if mic is denied.
     *
     * @returns {Promise<void>}
     */
    async start() {
        if (this._isRunning) return;

        this.init(); // idempotent

        try {
            this._stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 16000,   // faster-whisper works well at 16 kHz
                },
                video: false,
            });
        } catch (err) {
            console.error('[CaptionSystem] Microphone access denied:', err);
            this._setStatus('⚠ Microphone access denied');
            throw err;
        }

        this._isRunning = true;
        this._isEnabled = true;
        this._startAudioPipeline();
        this._updateToggleButton();
        this._setStatus('🎙 Live captions active');
        console.info('[CaptionSystem] Started recording.');
    }

    /**
     * Stop recording + transcription. Caption box is hidden immediately.
     * The microphone stream is released.
     */
    stop() {
        if (!this._isRunning) return;

        this._isRunning = false;
        this._isEnabled = false;
        this._teardownAudioPipeline();
        this._hideCaption(/* immediate= */ true);
        this._updateToggleButton();
        this._setStatus('Captions off');
        console.info('[CaptionSystem] Stopped.');
    }

    /** Toggle between started and stopped states. */
    toggle() {
        if (this._isRunning) this.stop();
        else this.start();
    }

    /**
     * Completely remove injected DOM nodes and release all resources.
     * After calling destroy(), call init() + start() to restart.
     */
    destroy() {
        this.stop();
        [this._overlayEl, this._statusBarEl, this._toggleBtnEl].forEach(el => el?.remove());
        this._overlayEl = null;
        this._textEl = null;
        this._statusBarEl = null;
        this._toggleBtnEl = null;
        console.info('[CaptionSystem] Destroyed.');
    }

    /** Read-only: true while recording */
    get isRunning() { return this._isRunning; }


    // ── DOM construction ──────────────────────────────────────────────────────

    _buildDOM() {
        // 1. Caption overlay
        this._overlayEl = document.createElement('div');
        this._overlayEl.id = 'caption-overlay';
        this._overlayEl.className = 'caption-overlay';
        this._overlayEl.setAttribute('role', 'status');
        this._overlayEl.setAttribute('aria-live', 'polite');
        this._overlayEl.setAttribute('aria-label', 'Live captions');

        // Mic dot + text span inside overlay
        const micDot = document.createElement('span');
        micDot.className = 'caption-mic-dot';

        this._textEl = document.createElement('span');
        this._textEl.className = 'caption-text';

        this._overlayEl.appendChild(micDot);
        this._overlayEl.appendChild(this._textEl);
        document.body.appendChild(this._overlayEl);

        // 2. Status bar (optional)
        if (this.showStatusBar) {
            this._statusBarEl = document.createElement('div');
            this._statusBarEl.id = 'caption-status-bar';
            this._statusBarEl.className = 'caption-status-bar';
            this._statusBarEl.textContent = 'Captions off';
            document.body.appendChild(this._statusBarEl);
        }

        // 3. Toggle button (optional)
        if (this.showToggleBtn) {
            this._toggleBtnEl = document.createElement('button');
            this._toggleBtnEl.id = 'caption-toggle-btn';
            this._toggleBtnEl.className = 'caption-toggle-btn';
            this._toggleBtnEl.title = 'Toggle live captions';
            this._toggleBtnEl.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <!-- Microphone icon -->
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" y1="19" x2="12" y2="23"/>
                    <line x1="8"  y1="23" x2="16" y2="23"/>
                </svg>
                <span class="btn-label">CC</span>
            `;
            this._toggleBtnEl.addEventListener('click', () => this.toggle());
            document.body.appendChild(this._toggleBtnEl);
        }
    }


    // ── Audio pipeline ────────────────────────────────────────────────────────

    _startAudioPipeline() {
        // ─ Audio context + analyser (for speech detection) ────────────────────
        this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this._analyser = this._audioCtx.createAnalyser();
        this._analyser.fftSize = FFT_SIZE;

        const source = this._audioCtx.createMediaStreamSource(this._stream);
        source.connect(this._analyser);

        const dataArray = new Uint8Array(this._analyser.frequencyBinCount);

        // RAF loop: measure volume, flag whether speech is present
        const measureVolume = () => {
            if (!this._isRunning) return;
            this._analyser.getByteFrequencyData(dataArray);
            const avg = dataArray.reduce((s, v) => s + v, 0) / dataArray.length;
            if (avg > this.volumeThreshold) {
                this._speechInSegment = true;
            }
            this._rafId = requestAnimationFrame(measureVolume);
        };
        measureVolume();

        // ─ MediaRecorder (2-second chunks) ───────────────────────────────────
        // Prefer audio/webm which is natively supported by Chromium browsers.
        // Fall back to the default MIME if webm is unavailable (e.g. Safari).
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm')
                ? 'audio/webm'
                : '';   // browser default

        const recorderOptions = mimeType ? { mimeType } : {};
        this._mediaRecorder = new MediaRecorder(this._stream, recorderOptions);

        this._mediaRecorder.ondataavailable = async (event) => {
            if (!event.data || event.data.size === 0) return;

            if (!this._speechInSegment) {
                // No speech detected in this window — skip the network round-trip
                this._speechInSegment = false;
                return;
            }
            this._speechInSegment = false; // reset for the next chunk

            await this._sendChunk(event.data);
        };

        // Start the recorder and rotate every CHUNK_INTERVAL_MS milliseconds
        this._mediaRecorder.start();

        this._chunkInterval = setInterval(() => {
            if (this._mediaRecorder?.state === 'recording') {
                this._mediaRecorder.requestData(); // fires ondataavailable
            }
        }, this.chunkIntervalMs);
    }

    _teardownAudioPipeline() {
        clearInterval(this._chunkInterval);
        this._chunkInterval = null;

        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }

        if (this._mediaRecorder && this._mediaRecorder.state !== 'inactive') {
            this._mediaRecorder.stop();
        }
        this._mediaRecorder = null;

        if (this._audioCtx) {
            this._audioCtx.close().catch(() => { });
            this._audioCtx = null;
        }

        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
    }


    // ── Network ───────────────────────────────────────────────────────────────

    /**
     * POST an audio Blob to the FastAPI /transcribe endpoint.
     * On success, show the returned text as a live caption.
     *
     * @param {Blob} blob  Raw audio chunk from MediaRecorder
     */
    async _sendChunk(blob) {
        this._pendingRequests++;
        const formData = new FormData();
        // Field name must match the FastAPI endpoint's parameter name ("audio")
        formData.append('audio', blob, 'chunk.webm');

        try {
            const response = await fetch(this.serverUrl, {
                method: 'POST',
                body: formData,
            });

            if (response.status === 204) {
                // Server detected no speech — don't update caption
                return;
            }

            if (!response.ok) {
                const errText = await response.text();
                console.warn('[CaptionSystem] Server error:', response.status, errText);
                return;
            }

            const data = await response.json();

            if (data.text && data.text.trim().length > 0) {
                this._showCaption(data.text.trim());
            }

        } catch (err) {
            // Network error (server down, CORS, etc.) — log but don't crash
            console.error('[CaptionSystem] Fetch error:', err);
        } finally {
            this._pendingRequests--;
        }
    }


    // ── Caption display ───────────────────────────────────────────────────────

    /**
     * Display text in the caption overlay and arm the auto-hide timer.
     *
     * @param {string} text  Transcribed caption text
     */
    _showCaption(text) {
        if (!this._overlayEl) return;

        // Update text
        this._textEl.textContent = text;

        // Make visible
        this._overlayEl.classList.add('caption-visible');

        // Reset auto-hide timer
        this._armHideTimer();
    }

    /**
     * Hide the caption overlay.
     *
     * @param {boolean} [immediate=false]  If true, skip the CSS transition delay.
     */
    _hideCaption(immediate = false) {
        if (!this._overlayEl) return;

        if (this._hideTimer) {
            clearTimeout(this._hideTimer);
            this._hideTimer = null;
        }

        if (immediate) {
            this._overlayEl.classList.remove('caption-visible');
            if (this._textEl) this._textEl.textContent = '';
        } else {
            // Let the CSS transition finish naturally (class removal triggers fade-out)
            this._overlayEl.classList.remove('caption-visible');
        }
    }

    /**
     * (Re-)arm the countdown timer that hides the caption overlay
     * after CAPTION_HIDE_DELAY_MS of silence.
     */
    _armHideTimer() {
        if (this._hideTimer) clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
            this._hideCaption(false);
        }, this.hideDelayMs);
    }


    // ── UI helpers ────────────────────────────────────────────────────────────

    _setStatus(message) {
        if (!this._statusBarEl) return;
        this._statusBarEl.textContent = message;
        this._statusBarEl.classList.toggle(
            'caption-status-visible',
            this._isEnabled,
        );
    }

    _updateToggleButton() {
        if (!this._toggleBtnEl) return;
        this._toggleBtnEl.classList.toggle('btn-active', this._isRunning);
        const label = this._toggleBtnEl.querySelector('.btn-label');
        if (label) label.textContent = this._isRunning ? 'CC on' : 'CC';
        this._toggleBtnEl.title = this._isRunning
            ? 'Stop live captions'
            : 'Start live captions';
    }
}


// ── Auto-initialise when used as a plain <script> tag (non-module) ────────────
// If the page loads this script WITHOUT type="module", wire up automatically.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.CaptionSystem = CaptionSystem; // expose globally for non-module usage

    // Auto-start demo mode only when this script is loaded directly
    // (i.e. not imported by another module). We detect this by checking
    // whether the script's own URL is the last script on the page, which
    // is a common pattern for "self-contained" scripts.
    document.addEventListener('DOMContentLoaded', () => {
        // Expose a ready-made instance on window for quick console testing
        if (!window._captionSystemAuto) {
            window._captionSystemAuto = new CaptionSystem();
            window._captionSystemAuto.init();
            console.info(
                '[CaptionSystem] Ready. Call window._captionSystemAuto.start() to begin.'
            );
        }
    });
}
