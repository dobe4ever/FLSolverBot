// src/services/gemini.service.js

// IMPORTS:
const { GoogleGenAI } = require("@google/genai");

// Track which API key is active
let activeKeyIndex = 0;
const API_KEYS = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2
].filter(Boolean); // Remove undefined keys

// Initialize the Gemini client
let ai = new GoogleGenAI({
    apiKey: API_KEYS[activeKeyIndex],
});

// CONST:
const temperature = 0;
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

const MODEL_CONFIGS = {
    'pro': {
        provider: 'gemini', 
        name: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        thinkingBudget: -1,
    },
    'flash': {
        provider: 'gemini',  
        name: 'gemini-flash-latest',
        displayName: 'Gemini Flash',
        thinkingBudget: -1,
    },
};

// DEFAULS:
let currentModelKey = 'pro';

// Rotates to the next API key
function rotateApiKey() {
    if (API_KEYS.length < 2) return false;
    
    activeKeyIndex = (activeKeyIndex + 1) % API_KEYS.length;
    ai = new GoogleGenAI({
        apiKey: API_KEYS[activeKeyIndex],
    });
    console.log(`🔄 [GEMINI] Rotated to API key ${activeKeyIndex + 1}`);
    return true;
}

// CONFIGS
function setModel(modelKey) {
    if (MODEL_CONFIGS[modelKey]) {
        currentModelKey = modelKey;
        return true;
    }
    return false;
}

function getCurrentModel() {
    return MODEL_CONFIGS[currentModelKey];
}

function getAvailableModels() {
    return MODEL_CONFIGS;
}

// MAIN FUNC
async function identifyCardsFromImage(imageBuffer) {
    const modelConfig = MODEL_CONFIGS[currentModelKey];
    
    const config = {
        temperature: temperature,
        thinkingConfig: {
            thinkingBudget: modelConfig.thinkingBudget,
        },
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
            model: modelConfig.name,
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
                // Retry with new key
                const response = await ai.models.generateContent({
                    model: modelConfig.name,
                    config,
                    contents,
                });
                return response.text;
            }
        }
        
        // Re-throw error with full details for centralized handling
        throw error;
    }
}

module.exports = { 
    identifyCardsFromImage, 
    setModel, 
    getCurrentModel, 
    getAvailableModels 
};








// import { GoogleGenAI, } from '@google/genai';

// const ai = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY,});
// const model = 'gemini-2.5-pro';
// const config = {
//     temperature: 0,
//     thinkingConfig: {
//       thinkingBudget: -1,
//     },
//     mediaResolution: 'MEDIA_RESOLUTION_HIGH',
//     systemInstruction: [
//         {
//           text: `test`,
//         }
//     ],
//   };
// const contents = [
//     {
//         role: 'user',
//         parts: [
//             {
//                 inlineData: {
//                     mimeType: 'image/jpeg',
//                     data: imageBuffer.toString("base64"),
//                 },
//             },
//         ],
//     },
// ];

// async function main() {
//   const response = await ai.models.generateContent({model, config, contents,});
//   return response.text;
// }

// main();

// return response.text;