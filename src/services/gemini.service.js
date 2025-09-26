// src/services/gemini.service.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const temperature = 0;
const systemInstruction = `You will be analyzing a screenshot of a poker app that shows several playing cards in a row. These cards use 4 colors: Green for clubs, blue for diamonds, red for hearts, and black for spades. Your task is to identify each card's rank and suit, then output them in standard poker notation. Instructions: First, carefully identify each card by writing out the rank, color and suit of one card at a time, starting from the first card on the left. E.g., '1. ten, green, clubs. 2. queen, green, clubs. 3. queen, black, spades. And so on...' Then return the final result formatted as standard poker notation to represent each card like this: e.g., AS for Ace of Spades, TC for ten of clubs, etc, cards separated by single spaces and all enclosed in triple backticks.`;

/**
 * Identifies cards from an image buffer using Gemini Vision.
 * @param {Buffer} imageBuffer The image data as a buffer.
 * @returns {Promise<string|null>} A string of card codes, or null if parsing fails.
 */
async function identifyCardsFromImage(imageBuffer) {
    try {
        const prompt = {
            contents: [{
                role: 'user',
                parts: [{
                    inlineData: {
                        mimeType: 'image/jpeg', // Assuming jpeg, but Gemini is flexible
                        data: imageBuffer.toString("base64"),
                    },
                }],
            }],
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            generationConfig: {
                temperature: temperature, // You can also just write `temperature,`
            }
        };

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Extract the content from between the triple backticks
        const match = responseText.match(/\`\`\`([\s\S]*?)\`\`\`/);

        if (match && match[1]) {
            // Return the cleaned, trimmed string of cards
            return match[1].trim();
        } else {
            console.error("Gemini response did not contain the expected format:", responseText);
            return null; // Or throw an error if you prefer
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get a valid response from the vision model.");
    }
}

module.exports = { identifyCardsFromImage };
