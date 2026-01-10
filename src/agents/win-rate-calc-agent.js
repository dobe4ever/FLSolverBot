// src/agents/win-rate-calc.agent.js

// IMPORTS:
const { GoogleGenAI } = require("@google/genai");

// Track which API key is active
let activeKeyIndex = 0;
const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2
].filter(Boolean);

// Initialize the Gemini client
let ai = new GoogleGenAI({
    apiKey: API_KEYS[activeKeyIndex],
});

// CONST:
const MODEL_NAME = 'gemini-3-flash-preview';
const MODEL_DISPLAY_NAME = 'Gemini 3 Flash Preview';

// Placeholder for future implementation
const systemInstruction = `[Win rate calculator system instruction will be added here]`;

// Rotates to the next API key
function rotateApiKey() {
    if (API_KEYS.length < 2) return false;
    
    activeKeyIndex = (activeKeyIndex + 1) % API_KEYS.length;
    ai = new GoogleGenAI({
        apiKey: API_KEYS[activeKeyIndex],
    });
    console.log(`🔄 [WIN-RATE-CALC] Rotated to API key #${activeKeyIndex + 1}`);
    return true;
}

// Get current API key number
function getActiveKeyNumber() {
    return activeKeyIndex + 1;
}

// Get model info
function getModelInfo() {
    return {
        name: MODEL_NAME,
        displayName: MODEL_DISPLAY_NAME
    };
}

// MAIN FUNC - Placeholder for future implementation
async function processWinRateData(data, chatId = null, bot = null) {
    // TODO: Implement win rate calculation logic with function calling
    throw new Error('Win rate calculator not yet implemented');
}

module.exports = { 
    processWinRateData,
    getModelInfo,
    getActiveKeyNumber
};