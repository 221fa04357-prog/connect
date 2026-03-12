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
async function getChatCompletion(messages, model = "llama-3.3-70b-versatile") {
    if (!groq) {
        console.warn("GROQ_API_KEY is missing. AI features are disabled.");
        return "AI features are currently unavailable due to missing API configuration.";
    }

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an intelligent AI Companion for NeuralChat, a video conferencing platform. Your goal is to help users during meetings by summarizing discussions, tracking action items, and answering questions based on the meeting context. Be concise, professional, and helpful."
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
 * Generate structured recap from transcript
 * @param {string} transcript - The full transcript text
 */
async function generateRecapContent(transcript) {
    const prompt = `
        Based on the following meeting transcript, generate two things:
        1. A concise list of key summary points.
        2. A list of specific, actionable tasks or next steps.

        Format your response as a JSON object with exactly these two keys:
        - "summary": an array of strings (the summary points).
        - "actionItems": an array of strings (the task descriptions).

        Transcript:
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
 * Summarize meeting transcript
 * @param {string} transcript - The full transcript text
 */
async function summarizeMeeting(transcript) {
    const messages = [
        {
            role: "user",
            content: `Please provide a concise summary of the following meeting transcript. Identify key topics, decisions made, and follow-up action items: \n\n${transcript}`
        }
    ];

    return getChatCompletion(messages);
}

const HALLUCINATION_PHRASES = [
    "I don't even know",
    "I'm not sure what to say",
    "even know what to say",
    "thank you for watching",
    "thanks for watching",
    "subscribe to my channel",
    "please subscribe",
    "you for watching",
    "I don't know what to say",
    "I don't know",
    "even know",
    "don't know",
    "what to say",
    "thank you",
    "thanks.",
    "thanks"
];

/**
 * Transcribe audio file using Groq Whisper
 * @param {string} audioPath - Path to the audio file
 * @param {string} language - ISO language code (default: en)
 */
async function transcribeAudio(audioPath, language = "en") {
    if (!groq) {
        throw new Error("GROQ_API_KEY is missing");
    }

    try {
        const fs = require('fs');
        const transcription = await groq.audio.transcriptions.create({
            file: fs.createReadStream(audioPath),
            model: "whisper-large-v3",
            response_format: "json",
            language: language || "en",
            prompt: "NeuralChat meeting transcript. Speak clearly.", // Helps guide Whisper
            temperature: 0.0, // More deterministic, helps reduce hallucinations
        });

        let text = transcription.text || "";

        // Post-processing: Hallucination filtering
        const cleanText = text.trim();
        const lowerText = cleanText.toLowerCase();

        // If the entire text is a common hallucination or contains it in a suspicious way (short strings)
        if (cleanText.length < 30) {
            for (const phrase of HALLUCINATION_PHRASES) {
                if (lowerText.includes(phrase.toLowerCase()) && cleanText.length < phrase.length + 10) {
                    console.log(`[Transcription] Filtered hallucination: "${cleanText}"`);
                    return "";
                }
            }
        }

        return cleanText;
    } catch (error) {
        console.error("Groq Transcription Error:", error);
        throw error;
    }
}

module.exports = {
    getChatCompletion,
    summarizeMeeting,
    generateRecapContent,
    transcribeAudio
};
