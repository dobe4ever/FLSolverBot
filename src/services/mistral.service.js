// src/services/mistral.service.js

const { Mistral } = require("@mistralai/mistralai");

// Initialize the Mistral client
const client = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
});

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

// Model configurations
const MODEL_CONFIGS = {
    'mistral-large': {
        name: 'mistral-large-2411',
        displayName: 'Mistral Large',
    },
    'mistral-small': {
        name: 'mistral-small-2506',
        displayName: 'Mistral Small',
    },
};

// Default model
let currentModelKey = 'mistral-small';

/**
 * Sets the current model to use
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
 */
function getCurrentModel() {
    return MODEL_CONFIGS[currentModelKey];
}

/**
 * Gets all available models
 */
function getAvailableModels() {
    return MODEL_CONFIGS;
}

/**
 * Identifies cards from an image buffer using Mistral Vision.
 * Throws error with full details for centralized handling.
 * @param {Buffer} imageBuffer The image data as a buffer.
 * @returns {Promise<string>} Raw response text from the model
 */
async function identifyCardsFromImage(imageBuffer) {
    const modelConfig = MODEL_CONFIGS[currentModelKey];
    
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const base64DataUrl = `data:image/jpeg;base64,${base64Image}`;

    const chatResponse = await client.chat.complete({
        model: modelConfig.name,
        temperature: temperature,
        messages: [
            {
                role: "system",
                content: systemInstruction,
            },
            {
                role: "user",
                content: [
                    {
                        type: "image_url",
                        imageUrl: base64DataUrl,
                    },
                ],
            },
        ],
    });

    return chatResponse.choices[0].message.content;
}

module.exports = { 
    identifyCardsFromImage, 
    setModel, 
    getCurrentModel, 
    getAvailableModels 
};