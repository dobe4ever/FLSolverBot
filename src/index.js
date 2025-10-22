// src/index.js

const TelegramBot = require('node-telegram-bot-api');
const { performance } = require('perf_hooks');
const { solveOptimizedV2, parseCard } = require('./solver/solver.js');
const geminiService = require('./services/gemini.service.js');
const mistralService = require('./services/mistral.service.js');

// ========== NEW CODE START: HTTP Server for Render ==========
const express = require('express');
const app = express();

// Simple health check endpoint to keep Render happy
app.get('/', (req, res) => {
    res.send('🚀 FL Solver Bot is alive and solving poker hands!');
});

// Start the HTTP server on the port Render assigns
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});
// ========== NEW CODE END: HTTP Server for Render ==========

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set!');
    process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set!');
    process.exit(1);
}
if (!process.env.MISTRAL_API_KEY) {
    console.error('Error: MISTRAL_API_KEY is not set!');
    process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// ========== MODEL MANAGEMENT ==========

// Create a unified model config by merging both services
function getAllModels() {
    const geminiModels = geminiService.getAvailableModels();
    const mistralModels = mistralService.getAvailableModels();
    
    // Add provider field to models
    const geminiWithProvider = {};
    for (const key in geminiModels) {
        geminiWithProvider[key] = {
            ...geminiModels[key],
            provider: 'gemini'
        };
    }
    
    const mistralWithProvider = {};
    for (const key in mistralModels) {
        mistralWithProvider[key] = {
            ...mistralModels[key],
            provider: 'mistral'
        };
    }
    
    return { ...geminiWithProvider, ...mistralWithProvider };
}

// Track current provider and model
let currentProvider = 'gemini';
let currentModelKey = 'flash';

function setCurrentModel(modelKey) {
    const allModels = getAllModels();
    const model = allModels[modelKey];
    
    if (!model) return false;
    
    currentProvider = model.provider;
    currentModelKey = modelKey;
    
    // Set the model in the appropriate service
    if (currentProvider === 'gemini') {
        return geminiService.setModel(modelKey);
    } else if (currentProvider === 'mistral') {
        return mistralService.setModel(modelKey);
    }
    
    return false;
}

function getCurrentModel() {
    if (currentProvider === 'gemini') {
        return { ...geminiService.getCurrentModel(), provider: 'gemini' };
    } else if (currentProvider === 'mistral') {
        return { ...mistralService.getCurrentModel(), provider: 'mistral' };
    }
}

// Route to the correct service based on current provider
async function identifyCardsFromImage(imageBuffer) {
    if (currentProvider === 'gemini') {
        return geminiService.identifyCardsFromImage(imageBuffer);
    } else if (currentProvider === 'mistral') {
        return mistralService.identifyCardsFromImage(imageBuffer);
    }
    throw new Error('Unknown provider');
}

// ========== UTILITY FUNCTIONS ==========

/**
 * Formats a card string with a colored emoji for its suit.
 * @param {string} cardStr - e.g., "AS", "KH", "TD"
 * @returns {string} - e.g., "A♠️", "K❤️", "T🔷"
 */
function formatCardWithColor(cardStr) {
    if (!cardStr || cardStr.length < 2) return cardStr;
    const rank = cardStr.slice(0, -1);
    const suit = cardStr.slice(-1);
    switch (suit) {
        case '♠': return rank + '♠️';
        case '♥': return rank + '❤️';
        case '♦': return rank + '🔷';
        case '♣': return rank + '🟢';
        default: return cardStr;
    }
}

// --- Reusable Solver Function ---
async function runSolverAndReply(chatId, cardString) {
    try {
        const cardCodes = cardString.trim().split(/\s+/);
        const numCards = cardCodes.length;

        if (numCards < 14 || numCards > 17) {
            bot.sendMessage(chatId, `❌ *Error:* I found ${numCards} cards, but I can only solve for 14, 15, 16, or 17. Please try a clearer screenshot.`, { parse_mode: 'Markdown' });
            return;
        }

        const parsedCards = cardCodes.map(parseCard);
        const invalidCards = parsedCards.filter(c => c === null);

        if (invalidCards.length > 0) {
            bot.sendMessage(chatId, `❌ *Error:* I couldn't understand some of the cards identified. The model might have made a mistake. Please try again.`, { parse_mode: 'Markdown' });
            return;
        }
        // INFO
        await bot.sendMessage(chatId, "cards parsed", { parse_mode: 'Markdown' });
        console.log(`cards parsed`);

        const startTime = performance.now();
        const { best } = solveOptimizedV2(parsedCards);
        const endTime = performance.now();
        const solveTime = ((endTime - startTime) / 1000).toFixed(3);
        // INFO
        await bot.sendMessage(chatId, "got solution", { parse_mode: 'Markdown' });
        console.log(`got solution`);


        if (!best) {
            bot.sendMessage(chatId, "Couldn't find a valid arrangement. This is unexpected!");
            return;
        }

        const repeatText = best.isRepeat ? '✅ (Repeat Fantasyland EV)' : '';

        // Apply the new color formatting to all card arrays
        const frontFormatted = best.front.map(formatCardWithColor).join(' ');
        const middleFormatted = best.middle.map(formatCardWithColor).join(' ');
        const backFormatted = best.back.map(formatCardWithColor).join(' ');
        const discardsFormatted = best.discards.map(formatCardWithColor).join(' ');

        const resultMessage = `*Optimal Arrangement Found!*

\`${frontFormatted}\`
\`${middleFormatted}\`
\`${backFormatted}\`

*Discards:* \`${discardsFormatted}\`

*Score:* ${best.finalEV.toFixed(2)} pts ${repeatText}
*Time:* ${solveTime} seconds (solver)
        `;
        // INFO
        await bot.sendMessage(chatId, "solution formatted", { parse_mode: 'Markdown' });
        console.log(`solution formatted`);

        bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Solver Error:", error);
        bot.sendMessage(chatId, "An unexpected error occurred while solving. Please check the server logs.");
    }
}

// ========== BOT COMMANDS ==========

// --- /start command ---
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const currentModel = getCurrentModel();
    const startMessage = `Hello! 👋 Just send me a screenshot of your cards, and I'll find the optimal arrangement for you.

*Current Vision Model:* ${currentModel.displayName}
*Available Commands:*
/model - Switch vision model
/pro - Gemini 2.5 Pro
/flash - Gemini Flash
/mistrallarge - Mistrall Large
`;
    bot.sendMessage(chatId, startMessage, { parse_mode: 'Markdown' });
});

// --- /solve command (for text input) ---
bot.onText(/\/solve (.+)/, (msg, match) => {
    runSolverAndReply(msg.chat.id, match[1]);
});

// --- /model command (switch models) ---
bot.onText(/\/model/, (msg) => {
    const chatId = msg.chat.id;
    const allModels = getAllModels();
    // const currentModel = getCurrentModel();
    
    const keyboard = {
        inline_keyboard: Object.keys(allModels).map(key => [{
            text: `${allModels[key].displayName} (${allModels[key].provider})${key === currentModelKey ? ' ✓' : ''}`,
            callback_data: `model_${key}`
        }])
    };
    
    bot.sendMessage(chatId, '*Select Vision Model:*', { 
        parse_mode: 'Markdown',
        reply_markup: keyboard 
    });
});

// --- /status command ---
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const currentModel = getCurrentModel();
    
    const statusMessage = `*Current Bot Settings:*

*Vision Model:* ${currentModel.displayName}
*Provider:* ${currentModel.provider}
*Model ID:* \`${currentModel.name}\`

Use /model to switch models.
`;
    bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

// --- Direct command handlers for Gemini models ---

bot.onText(/\/flash/, (msg) => {
    const chatId = msg.chat.id;
    const success = setCurrentModel('flash');
    
    if (success) {
        const newModel = getCurrentModel();
        bot.sendMessage(chatId, `✅ *Vision model changed to:* ${newModel.displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

bot.onText(/\/pro/, (msg) => {
    const chatId = msg.chat.id;
    const success = setCurrentModel('pro');
    
    if (success) {
        const newModel = getCurrentModel();
        bot.sendMessage(chatId, `✅ *Vision model changed to:* ${newModel.displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

// --- Direct command handlers for Mistral models ---
bot.onText(/\/mistrallarge/, (msg) => {
    const chatId = msg.chat.id;
    const success = setCurrentModel('mistral-large');
    
    if (success) {
        const newModel = getCurrentModel();
        bot.sendMessage(chatId, `✅ *Vision model changed to:* ${newModel.displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

// --- Handle model selection callbacks ---
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data.startsWith('model_')) {
        const modelKey = data.replace('model_', '');
        const success = setCurrentModel(modelKey);
        
        if (success) {
            const newModel = getCurrentModel();
            bot.answerCallbackQuery(query.id, { text: `Switched to ${newModel.displayName}` });
            bot.editMessageText(`✅ *Vision model changed to:* ${newModel.displayName} (${newModel.provider})`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Error switching model' });
        }
    }
});

// --- Photo Handler (for image input) ---
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Let the user know the bot is working
        bot.sendChatAction(chatId, 'typing');

        // Get the highest resolution photo
        const photo = msg.photo[msg.photo.length - 1];
        const fileStream = bot.getFileStream(photo.file_id);
        // INFO
        await bot.sendMessage(chatId, "got image", { parse_mode: 'Markdown' });
        console.log(`got image`);

        // Download the image into a buffer
        const chunks = [];
        for await (const chunk of fileStream) {
            chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);
        // INFO
        await bot.sendMessage(chatId, "got base64", { parse_mode: 'Markdown' });
        console.log(`got base64`);

        // Call the appropriate vision service to identify cards
        const cardStringFromVision = await identifyCardsFromImage(imageBuffer);
        // INFO
        await bot.sendMessage(chatId, "got model response", { parse_mode: 'Markdown' });
        console.log(`got model response`);

        if (!cardStringFromVision) {
            await bot.sendMessage(chatId, "Sorry, I couldn't extract the cards from that image. Please try a clearer screenshot without any obstructions.");
            return;
        }

        // Send the extracted cards immediately
        await bot.sendMessage(chatId, `📋 *Cards identified:*\n\`/solve ${cardStringFromVision}\``, { parse_mode: 'MarkdownV2' });

        // Run the solver with the identified cards and send the final reply
        // await runSolverAndReply(chatId, cardStringFromVision);
        // // INFO
        // await bot.sendMessage(chatId, "got solution", { parse_mode: 'Markdown' });


    } catch (error) {
        console.error("Photo Handler Error:", error);
        await bot.sendMessage(chatId, "An error occurred while processing your image. Please try again.");
    }
});

console.log('🚀 FL Solver Bot is running and listening for commands and photos!');

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});