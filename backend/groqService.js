const Groq = require("groq-sdk");
require("dotenv").config();

const groq = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

/**
 * Get AI Completion from Groq
 * @param {Array} messages - List of message objects {role, content}
 * @param {string} model - Groq model to use (current: llama-3.3-70b-versatile)
 */
async function getChatCompletion(messages, model = "llama-3.3-70b-versatile", userName = "Participant") {
    if (!groq) {
        console.warn("GROQ_API_KEY is missing. AI features are disabled.");
        return "AI features are currently unavailable due to missing API configuration.";
    }

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are an intelligent AI Companion for NeuralChat, a video conferencing platform. Your goal is to help users during meetings by summarizing discussions, tracking action items, and answering questions based on the meeting context. Be concise, professional, and helpful. 

IMPORTANT RULES for your responses:
1. NEVER mention or complain if chat messages, transcriptions, or audio data are missing or empty. 
2. NEVER use phrases like 'There are no chat messages to incorporate', 'No chat messages in the provided data', or 'Based on the missing data'.
3. Simply provide the requested summary, email, or answer based ONLY on whatever text data you do receive. 
4. If NO data is provided at all, simply say 'No significant discussion or chat activity has been recorded for this period yet.' 
5. Do not provide any meta-commentary about the quality or quantity of the input data.
6. If you are asked to draft an email, ALWAYS sign off with "Best Regards, ${userName}". NEVER use placeholders like [Your Name].`
                },
                ...messages
            ],
            model: model,
        });

        return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
        console.error("Groq API Error:", error);
        throw new Error("Failed to get AI response");
    }
}

/**
 * Generate structured recap from transcript and chat logs
 * @param {string} transcript - The combined transcript text and chat messages
 */
async function generateRecapContent(transcript) {
    const prompt = `
        Based on the following meeting data (which may include both Spoken Transcription and Chat Messages), generate two things:
        1. A concise list of key summary points from the discussion.
        2. A list of specific, actionable tasks, next steps, or decisions made.

        IMPORTANT: If chat messages or spoken transcripts are empty, do not mention it. Just extract the summary and tasks from whatever text is present.

        Format your response as a JSON object with exactly these two keys:
        - "summary": an array of strings (the summary points).
        - "actionItems": an array of strings (the task descriptions).

        Meeting Data:
        ${transcript}
    `;

    try {
        const response = await getChatCompletion([{ role: "user", content: prompt }]);
        // Extract JSON from response (handling potential markdown blocks)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return { summary: [], actionItems: [] };
    } catch (error) {
        console.error("Error generating auto-recap content:", error);
        return { summary: [], actionItems: [] };
    }
}

/**
 * Generate smart replies based on the current conversation context.
 * @param {Array} messages - The conversation history.
 * @returns {Array<string>} An array of suggested smart replies.
 */
async function generateSmartReplies(messages) {
    const prompt = `
        Based on the following conversation, suggest 3-5 short, concise, and relevant smart replies.
        Each reply should be a short phrase or sentence, suitable for a quick response.
        Return the replies as a JSON array of strings.

        Conversation:
        ${messages.map(m => `${m.role}: ${m.content}`).join('\n')}
    `;

    try {
        const response = await getChatCompletion([{ role: "user", content: prompt }]);
        const jsonMatch = response.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }
        return ["Got it!", "Understood.", "Looking into it."];
    } catch (error) {
        console.error("Error generating smart replies:", error);
        return ["Got it!", "Understood.", "Looking into it."];
    }
}

/**
 * Translate text into a target language
 * @param {string} text - The text to translate.
 * @param {string} targetLanguage - The target language (e.g., "French", "es", "German").
 * @returns {string} The translated text.
 */
async function translateText(text, targetLanguage) {
    const prompt = `Translate the following text into ${targetLanguage}: "${text}"`;
    try {
        const response = await getChatCompletion([{ role: "user", content: prompt }]);
        return response.trim();
    } catch (error) {
        console.error("Error translating text:", error);
        return text; // Return original text on error
    }
}

/**
 * Summarize meeting transcript and chat logs
 * @param {string} transcript - The combined transcript text and chat logs
 */
async function summarizeMeeting(transcript) {
    const messages = [
        {
            role: "user",
            content: `Please provide a concise summary of the following meeting data (which includes Spoken Transcription and Chat Messages). Identify key topics, decisions made, and follow-up action items. Do not mention if either the chat or spoken transcripts are missing; just summarize what is there: \n\n${transcript}`
        }
    ];

    return getChatCompletion(messages);
}

// No filtering phrases - per user request for raw transcription.

const LANGUAGE_MAPPING = {
    'English': 'en',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Italian': 'it',
    'Portuguese': 'pt',
    'Chinese': 'zh',
    'Japanese': 'ja',
    'Korean': 'ko',
    'Russian': 'ru',
    'Hindi': 'hi',
    'Arabic': 'ar',
    'Turkish': 'tr',
    'Dutch': 'nl',
    'Vietnamese': 'vi',
    'Indonesian': 'id'
};

/**
 * Transcribe audio file using Groq Whisper
 * @param {string} audioPath - Path to the audio file
 * @param {string} language - ISO language code or full name (default: en)
 */
async function transcribeAudio(audioPath, language = "en") {
    if (!groq) {
        throw new Error("GROQ_API_KEY is missing");
    }

    try {
        const fs = require('fs');
        const path = require('path');

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        const stats = fs.statSync(audioPath);
        if (stats.size === 0) {
            console.warn(`[Transcription] Warning: Audio file is empty: ${audioPath}`);
            return "";
        }

        console.log(`[Transcription] Processing audio: ${path.basename(audioPath)} (${stats.size} bytes)`);

        // Map language name to ISO code if necessary
        let langCode = "en";
        if (language && typeof language === 'string') {
            const normalizedLang = language.trim();
            // Check if it's already an ISO code (2 chars)
            if (normalizedLang.length === 2) {
                langCode = normalizedLang.toLowerCase();
            } else {
                // Check mapping (case-insensitive)
                const mapped = Object.entries(LANGUAGE_MAPPING).find(
                    ([name]) => name.toLowerCase() === normalizedLang.toLowerCase()
                );
                if (mapped) {
                    langCode = mapped[1];
                } else {
                    console.warn(`[Transcription] Unsupported language name: "${language}", defaulting to "en"`);
                    langCode = "en";
                }
            }
        }

        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "verbose_json",
            language: langCode,
            temperature: 0.0,
        });

        // --- Confidence Filtering Logic ---
        // Whisper metadata keys:
        // no_speech_prob: Higher means likely silence.
        // avg_logprob: Lower (more negative) means lower confidence in text.

        const segments = transcription.segments || [];
        if (segments.length === 0) {
            console.log(`[Transcription] No segments returned for chunk.`);
            return "";
        }

        // Filter segments based on confidence markers
        const clearSegments = segments.filter(seg => {
            const noSpeech = seg.no_speech_prob || 0;
            const logProb = seg.avg_logprob || 0;
            const rawText = (seg.text || "").trim();
            const text = rawText.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");

            // Logging for all segments to help tune thresholds
            console.log(`[Transcription] Segment: "${rawText}" (no_speech=${noSpeech.toFixed(2)}, logprob=${logProb.toFixed(2)})`);

            // 1. High probability of no speech (Standard hallucination trigger)
            if (noSpeech > 0.6) {
                console.log(`[Transcription] Filtered: High no_speech_prob`);
                return false;
            }

            // 2. Very low average log probability (Random text trigger)
            if (logProb < -1.0) {
                console.log(`[Transcription] Filtered: Low log_prob`);
                return false;
            }

            // 3. Solitary Hallucination Filter (Highly Sensitive)
            // If the chunk consists ONLY of a known hallucination phrase,
            // we reject it even if the confidence markers are mostly okay.
            const commonHallucinations = ["thank you", "thanks for watching", "thanks", "bye", "you"];
            const isHallucination = commonHallucinations.includes(text);

            // Rejection criteria for solitary common phrases:
            // - If it's a known hallucination AND no_speech_prob is > 0.1 (any sign of silence)
            // - OR if it's the ONLY segment in the chunk (solitary) and confidence is borderline
            if (isHallucination) {
                if (noSpeech > 0.1 || (segments.length === 1 && (noSpeech > 0.05 || logProb < -0.2))) {
                    console.log(`[Transcription] Rejected isolated hallucination: "${rawText}"`);
                    return false;
                }
            }

            return true;
        });

        const finalText = clearSegments.map(s => s.text).join(" ").trim();

        if (finalText.length > 0) {
            console.log(`[Transcription] Final Result: "${finalText}"`);
        } else if (transcription.text && transcription.text.trim().length > 0) {
            console.log(`[Transcription] Suppressed raw: "${transcription.text}" (Metadata-based filter)`);
        }

        return finalText;
    } catch (error) {
        console.error("Groq Transcription Error:", error);
        throw error;
    }
}

module.exports = {
    getChatCompletion,
    summarizeMeeting,
    generateRecapContent,
    transcribeAudio,
    translateText,
    LANGUAGE_MAPPING
};
