// src/services/gemini.service.js

// IMPORTS:
const { GoogleGenAI } = require("@google/genai");

// Track which API key is active
let activeKeyIndex = 0;
const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3,
    process.env.GEMINI_API_KEY_4,
    process.env.GEMINI_API_KEY_5,
    process.env.GEMINI_API_KEY_6
].filter(Boolean); // Remove undefined keys

// Initialize the Gemini client
let ai = new GoogleGenAI({
    apiKey: API_KEYS[activeKeyIndex],
});

// CONST:
const MODEL_NAME = 'gemini-3-flash-preview';
const MODEL_DISPLAY_NAME = 'Gemini 3 Flash Preview';

const systemInstruction = `Your job is to extract the playing cards from the picture and return the result formatted as standard poker notation.

STEP 1 - CAREFULLY IDENTIFY EACH CARD:
Starting from the first card on the left, list each card writing out the rank and suit in words.
Format:
1. [rank], [suit]
2. [rank], [suit]
etc.

STEP 2 - CONVERT TO STANDARD NOTATION:
Use this exact notation system:
- RANKS: 2 3 4 5 6 7 8 9 T J Q K A
- SUITS: C = Clubs, D = Diamonds, H = Hearts, S = Spades

CRITICAL: 
- Ten is ALWAYS written as 'T', NEVER as '10'
- Each card is exactly 2 characters: rank + suit
- Example: TC = Ten of Clubs

STEP 3 - OUTPUT:
Provide all cards in a single line, separated by single spaces, enclosed in triple backticks.
- Example Format: \`\`\`9C TD 6S\`\`\``;

// Rotates to the next API key
function rotateApiKey() {
    if (API_KEYS.length < 2) return false;
    
    activeKeyIndex = (activeKeyIndex + 1) % API_KEYS.length;
    ai = new GoogleGenAI({
        apiKey: API_KEYS[activeKeyIndex],
    });
    console.log(`🔄 [GEMINI] Rotated to API key #${activeKeyIndex + 1}`);
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

// MAIN FUNC
async function identifyCardsFromImage(imageBuffer, chatId = null, bot = null) {
    const config = {
        temperature: 0,
        thinkingConfig: {
            thinkingLevel: 'MINIMAL',
        },
        mediaResolution: 'MEDIA_RESOLUTION_HIGH',
        systemInstruction: [
            {
                text: systemInstruction,
            }
        ],
    };

    const contents = [
        {
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBuffer.toString("base64"),
                    },
                },
            ],
        },
    ];

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            config,
            contents,
        });

        return response.text;

    } catch (error) {
        // Check if it's a quota/rate limit error
        if (error.status === 'RESOURCE_EXHAUSTED' || 
            (error.message && error.message.includes('quota'))) {
            
            // Try rotating API key automatically
            if (rotateApiKey()) {
                console.log('🔄 [GEMINI] Retrying with new API key...');
                
                // Notify user about key rotation
                if (chatId && bot) {
                    await bot.sendMessage(chatId, '⚠️ API limit reached, switching to backup key...');
                }
                
                // Retry with new key
                const response = await ai.models.generateContent({
                    model: MODEL_NAME,
                    config,
                    contents,
                });
                return response.text;
            }
        }
        
        // Re-throw error for centralized handling
        throw error;
    }
}

module.exports = { 
    identifyCardsFromImage,
    getModelInfo,
    getActiveKeyNumber
};
