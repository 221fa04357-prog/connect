"""
caption_server.py
─────────────────────────────────────────────────────────────────────────────
Real-time caption server for the ConnectPro webinar application.

Flow
    Browser (MediaRecorder, 2-second slices)
        └─► POST /transcribe  (multipart audio file)
                └─► faster-whisper (base model)
                        └─► { text: "..." }

Run
    pip install fastapi uvicorn faster-whisper python-multipart
    python caption_server.py
        — or —
    uvicorn caption_server:app --host 0.0.0.0 --port 8765 --reload
─────────────────────────────────────────────────────────────────────────────
"""

import os
import uuid
import tempfile
import logging

from fastapi import FastAPI, File, UploadFile, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from faster_whisper import WhisperModel

# ─── Logging ─────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
log = logging.getLogger("caption_server")

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ConnectPro Caption Server",
    description="Real-time speech-to-text captions powered by faster-whisper.",
    version="1.0.0",
)

# Allow all origins so the React/Vite dev server and the plain HTML demo
# can both reach the caption server. Tighten this in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Whisper Model ────────────────────────────────────────────────────────────
# "base" model: Multilingual support for Hindi, Telugu, etc.
# High accuracy + sub-second latency.
log.info("Loading faster-whisper 'base' model for high-accuracy multilingual captions …")
try:
    whisper_model = WhisperModel(
        "base", 
        device="cpu",
        compute_type="int8",
    )
    log.info("faster-whisper model loaded successfully ✓")
except Exception as exc:
    log.error("Failed to load faster-whisper model: %s", exc)
    whisper_model = None


# ─── Correction Dictionary ───────────────────────────────────────────────────
WORD_CORRECTION_MAP = {
    "employment": "deployment",
    "deep learning": "deployment",
    "the appointment": "deployment",
    "connect pro": "ConnectPro",
    "development": "Development",
    "cough": "(cough)",
    "sneeze": "(sneeze)",
    "pooji": "Pooji",
    "pusy": "Pooji",
    "pushy": "Pooji",
    "pussy": "Pooji",
    "puji": "Pooji",
    "navier": "Sravya",
    "stavje": "Sravya",
    "sravy": "Sravya",
    "stavia": "Sravya",
}

def apply_word_corrections(text: str) -> str:
    """Helper to swap common misheard words based on context."""
    if not text:
        return ""
    
    processed = text
    import re
    # Match both whole words and partials to be safe for names
    for misheard, correct in WORD_CORRECTION_MAP.items():
        pattern = re.compile(re.escape(misheard), re.IGNORECASE)
        processed = pattern.sub(correct, processed)
    
    return processed.strip()


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/", tags=["Health"])
async def root():
    """Quick health check — returns server status and model load state."""
    return {
        "status": "ok",
        "service": "ConnectPro Caption Server",
        "model_loaded": whisper_model is not None,
    }


@app.get("/health", tags=["Health"])
async def health():
    """Detailed health probe used by load-balancers / monitoring."""
    return {
        "status": "healthy" if whisper_model is not None else "degraded",
        "model": "faster-whisper small.en",
        "device": "cpu",
        "compute_type": "int8",
    }


# ─── Transcription endpoint ───────────────────────────────────────────────────
from fastapi import FastAPI, File, UploadFile, HTTPException, Response, WebSocket, WebSocketDisconnect
import io

@app.websocket("/transcribe")
async def transcribe_ws(websocket: WebSocket, lang: str = None):
    """
    WebSocket endpoint for high-speed streaming captions.
    Expects binary blobs of audio (WebM/Opus).
    Optional query param 'lang' (e.g. ?lang=english).
    """
    await websocket.accept()
    log.info("WebSocket connected. Preferred language: %s", lang)
    
    # Comprehensive map from UI labels to Whisper ISO codes
    lang_map = {
        "afrikaans": "af", "albanian": "sq", "amharic": "am", "arabic": "ar", "armenian": "hy", "assamese": "as", "azerbaijani": "az",
        "bashkir": "ba", "basque": "eu", "belarusian": "be", "bengali": "bn", "bosnian": "bs", "breton": "br", "bulgarian": "bg", "burmese": "my",
        "cantonese": "zh", "catalan": "ca", "chinese (simplified)": "zh", "chinese (traditional)": "zh", "croatian": "hr", "czech": "cs",
        "danish": "da", "dutch": "nl", "english": "en", "estonian": "et", "faroese": "fo", "finnish": "fi", "french": "fr",
        "galician": "gl", "georgian": "ka", "german": "de", "greek": "el", "gujarati": "gu", "haitian creole": "ht", "hausa": "ha", "hawaiian": "haw", "hebrew": "he", "hindi": "hi", "hungarian": "hu",
        "icelandic": "is", "indonesian": "id", "italian": "it", "japanese": "ja", "javanese": "jw", "kannada": "kn", "kazakh": "kk", "khmer": "km", "korean": "ko",
        "lao": "lo", "latin": "la", "latvian": "lv", "lithuanian": "lt", "luxembourgish": "lb",
        "macedonian": "mk", "malagasy": "mg", "malay": "ms", "malayalam": "ml", "maltese": "mt", "maori": "mi", "marathi": "mr", "mongolian": "mn",
        "nepali": "ne", "norwegian": "no", "occitan": "oc", "pashto": "ps", "persian": "fa", "polish": "pl", "portuguese": "pt", "punjabi": "pa",
        "romanian": "ro", "russian": "ru", "sanskrit": "sa", "serbian": "sr", "shona": "sn", "sindhi": "sd", "sinhala": "si", "slovak": "sk", "slovenian": "sl", "somali": "so", "spanish": "es", "sundanese": "su", "swahili": "sw", "swedish": "sv",
        "tagalog": "tl", "tajik": "tg", "tamil": "ta", "tatar": "tt", "telugu": "te", "thai": "th", "tibetan": "bo", "turkish": "tr", "turkmen": "tk",
        "ukrainian": "uk", "urdu": "ur", "uzbek": "uz", "vietnamese": "vi", "welsh": "cy", "yiddish": "yi", "yoruba": "yo"
    }
    
    whisper_lang = lang_map.get(lang.lower()) if lang else None
    
    # Debug: if not found in map, check if it's already a code
    if lang and not whisper_lang:
        processed_lang = lang.lower().strip()
        if len(processed_lang) <= 3:
            whisper_lang = processed_lang

    try:
        while True:
            # HANDLE HEARTBEAT: Ignore packets < 1000 bytes (too small to be audio)
            if not audio_data or len(audio_data) < 1000:
                continue
                
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                    tmp.write(audio_data)
                    tmp_path = tmp.name
                
                # Zoom-style: Higher threshold to prevent "and/the" hallucinations during silence
                segments_iter, info = whisper_model.transcribe(
                    tmp_path,
                    beam_size=2,        
                    language=whisper_lang,
                    initial_prompt="Pooji, Sravya, ConnectPro, deployment.",
                    vad_filter=False,  
                    condition_on_previous_text=False,
                    no_speech_threshold=0.45, 
                    log_prob_threshold=None,  
                    hallucination_silence_threshold=None,
                )
                
                try:
                    segments = list(segments_iter)
                    raw_text = " ".join(seg.text.strip() for seg in segments if seg.text.strip())
                    
                    # Extra filter: if it's just a single short common word, discard it if it was low-confidence
                    # (Whisper creates list(segments_iter), we can check probability if needed, 
                    # but threshold 0.45 usually handles it)
                except Exception as iter_err:
                    log.warning("Audio decoding failed for chunk: %s", iter_err)
                    raw_text = ""
                
                # Apply word corrections (e.g., Pusy -> Pooji)
                final_text = apply_word_corrections(raw_text)
                
                if final_text and len(final_text) > 1:
                    log.info("<<< Transcribed: '%s'", final_text)
                    await websocket.send_json({
                        "text": final_text,
                        "language": info.language
                    })
            except Exception as e:
                # Log warning but DO NOT crash the whole socket
                log.warning("Skipping malformed chunk: %s", e)
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    try:
                        os.remove(tmp_path)
                    except:
                        pass
                    
    except WebSocketDisconnect:
        log.info("WebSocket disconnected")
    except Exception as e:
        log.error("WebSocket error: %s", e)
        try:
            await websocket.close()
        except:
            pass

@app.post("/transcribe", tags=["Transcription"])
async def transcribe(audio: UploadFile = File(...)):
    """
    Accept an audio blob and return transcribed text.
    Optimized for accuracy with small.en and beam_size=5.
    """
    if whisper_model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    raw_bytes = await audio.read()
    if not raw_bytes:
        return Response(status_code=204)

    # Use temp file for decoding
    tmp_path = os.path.join(tempfile.gettempdir(), f"caption_{uuid.uuid4().hex}.webm")
    
    try:
        with open(tmp_path, "wb") as f:
            f.write(raw_bytes)

        # Transcribe with low-latency settings
        segments_iter, info = whisper_model.transcribe(
            tmp_path,
            beam_size=1,            
            initial_prompt="deployment, ConnectPro, webinar, meeting",
            vad_filter=False,
            condition_on_previous_text=False,
            hallucination_silence_threshold=0.1,
        )
        
        segments = list(segments_iter)
        raw_text = " ".join(seg.text.strip() for seg in segments if seg.text.strip())
        
        # Apply corrections
        final_text = apply_word_corrections(raw_text)

        if not final_text:
            return Response(status_code=204)

        log.info("Transcribed: %r", final_text[:120])
        return JSONResponse(content={"text": final_text, "language": info.language})

    except Exception as exc:
        log.exception("Error during transcription: %s", exc)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}")
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except:
                pass


# ─── Dev entry point ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "caption_server:app",
        host="0.0.0.0",
        port=8765,
        reload=False,
        log_level="info",
    )
