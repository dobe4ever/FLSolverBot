// src/services/mistral.service.js

const { Mistral } = require("@mistralai/mistralai");

const client = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
});

// DEFAULT
let currentModelKey = 'mistral-small';

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
    'mistral-large': {
        name: 'mistral-large-2411',
        displayName: 'Mistral Large',
    },
    'mistral-small': {
        name: 'mistral-small-2506',
        displayName: 'Mistral Small',
    },
};

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








// no, thats not what i had in mind. the idea is have a single centralized file for when i want to add/remove models. Something like this: 

// ```
// const System = '...'
// const temperature = 0
// // I can add more API options here in the future

// const Client = {
//     'mistral': {
//         client: '...',
//         endpoint: '...',
//         apiKey: '...',
//         models: ['...', '...']
//     },
//     'gemini': {
//         client: '...',
//         endpoint: '...',
//         apiKey: '...',
//         models: ['...', '...']
//     },
//     // I can add AI clients here in the future
// };

// // whatever else is needed
// ```

// Then have the mistral and gemini service files with only the function that calls the model & gets response, typically called chatcompletion or generateContent or whatever it might be for the particular client. Write the most basic chatcompletion function as per the official docs where the params are passed as variables like:

// ```
// async function main() {
//   const response = await ai.models.generateContent(
//   {
//     model: "gemini-2.5-flash",
//     contents: "Explain how AI works in a few words",
//   }
//     );
//   console.log(response.text);
// }
// ```

// ```