// src/services/gemini.service.js

const { GoogleGenAI } = require("@google/genai");

// Initialize the Gemini client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const temperature = 0;
const systemInstruction = `You are analyzing a screenshot of a poker app showing several playing cards face up in a row. Your job is to identify them and output them in standard poker notation.

STEP 1 - CAREFULLY IDENTIFY EACH CARD:
From the row of visible playing cards, starting from the first card on the left, list each card writing out the rank and suit in words.
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
- Example: TC = Ten of Clubs, 9H = Nine of Hearts, AS = Ace of Spades

STEP 3 - OUTPUT:
Provide all cards in a single line, separated by single spaces, enclosed in triple backticks.`;

// Model configurations - easy to add new models here
const MODEL_CONFIGS = {
    'flash': {
        provider: 'gemini',  
        name: 'gemini-flash-latest',
        displayName: 'Gemini Flash',
        thinkingBudget: -1,
    },
    'pro': {
        provider: 'gemini', 
        name: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        thinkingBudget: -1,
    },
    'lite': {
        provider: 'gemini', 
        name: 'gemini-flash-lite-latest',
        displayName: 'Gemini Flash Lite',
        thinkingBudget: -1,
    },
    // ... any other gemini models
};

// Default model
let currentModelKey = 'flash';

/**
 * Sets the current model to use
 * @param {string} modelKey - Key from MODEL_CONFIGS
 * @returns {boolean} - True if model was set successfully
 */
function setModel(modelKey) {
    if (MODEL_CONFIGS[modelKey]) {
        currentModelKey = modelKey;
        return true;
    }
    return false;
}

/**
 * Gets the current model configuration
 * @returns {object} - Current model config
 */
function getCurrentModel() {
    return MODEL_CONFIGS[currentModelKey];
}

/**
 * Gets all available models
 * @returns {object} - All model configurations
 */
function getAvailableModels() {
    return MODEL_CONFIGS;
}

/**
 * Identifies cards from an image buffer using Gemini Vision.
 * @param {Buffer} imageBuffer The image data as a buffer.
 * @returns {Promise<string|null>} A string of card codes, or null if parsing fails.
 */
async function identifyCardsFromImage(imageBuffer) {
    try {
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

        const response = await ai.models.generateContent({
            model: modelConfig.name,
            config,
            contents,
        });

        const responseText = response.text;

        // Extract the content from between the triple backticks
        const match = responseText.match(/\`\`\`([\s\S]*?)\`\`\`/);

        if (match && match[1]) {
            // Return the cleaned, trimmed string of cards
            return match[1].trim();
        } else {
            console.error("Gemini response did not contain the expected format:", responseText);
            return null;
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get a valid response from the vision model.");
    }
}

module.exports = { 
    identifyCardsFromImage, 
    setModel, 
    getCurrentModel, 
    getAvailableModels 
};