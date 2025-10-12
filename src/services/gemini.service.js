// src/services/gemini.service.js

const { GoogleGenAI } = require("@google/genai");

// Initialize the Gemini client
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

const temperature = 0;
const systemInstruction = `You are analyzing a screenshot of a poker app showing playing cards in a row.

STEP 1 - IDENTIFY EACH CARD:
List each card from left to right, writing out the full rank and suit in words.
Format: "1. [rank], [suit]. 2. [rank], [suit]." etc.

STEP 2 - CONVERT TO STANDARD NOTATION:
Use this exact notation system:
- RANKS: 2 3 4 5 6 7 8 9 T J Q K A
  (T = Ten, J = Jack, Q = Queen, K = King, A = Ace)
- SUITS: C D H S
  (C = Clubs, D = Diamonds, H = Hearts, S = Spades)

CRITICAL: 
- Ten is ALWAYS written as 'T', NEVER as '10'
- Each card is exactly 2 characters: rank + suit

STEP 3 - OUTPUT:
Provide all cards in a single line, separated by single spaces, enclosed in triple backticks.
Example: \`\`\`AS KH TC 9D\`\`\``;

/**
 * Identifies cards from an image buffer using Gemini Vision.
 * @param {Buffer} imageBuffer The image data as a buffer.
 * @returns {Promise<string|null>} A string of card codes, or null if parsing fails.
 */
async function identifyCardsFromImage(imageBuffer) {
    try {
        const model = 'gemini-pro-latest';
        
        const config = {
            temperature: temperature,
            thinkingConfig: {
                thinkingBudget: 0,
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
            model,
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

module.exports = { identifyCardsFromImage };