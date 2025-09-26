// src/services/gemini.service.js

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const temperature = 0;
const systemInstruction = `Identify the cards in the user's screenshot. Then output the final solution in text format. I.e.: AS KS QS JS TS 9S 8H 7H 6C 5C 4C 3C 2C AD. Where S is for spades, H is for hearts, and so on. Enclose the final solution in triple backticks (\`\`\`)`;

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
