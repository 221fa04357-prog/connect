const Groq = require("groq-sdk");
require("dotenv").config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Get AI Completion from Groq
 * @param {Array} messages - List of message objects {role, content}
 * @param {string} model - Groq model to use (current: llama-3.3-70b-versatile)
 */
async function getChatCompletion(messages, model = "llama-3.3-70b-versatile") {
    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are an intelligent AI Companion for ConnectPro, a video conferencing platform. Your goal is to help users during meetings by summarizing discussions, tracking action items, and answering questions based on the meeting context. Be concise, professional, and helpful."
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

module.exports = {
    getChatCompletion,
    summarizeMeeting,
    generateRecapContent
};
