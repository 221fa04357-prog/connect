const Groq = require("groq-sdk");
require("dotenv").config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

/**
 * Get AI Completion from Groq
 * @param {Array} messages - List of message objects {role, content}
 * @param {string} model - Groq model to use (default: llama3-8b-8192)
 */
async function getChatCompletion(messages, model = "llama3-8b-8192") {
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
    summarizeMeeting
};
