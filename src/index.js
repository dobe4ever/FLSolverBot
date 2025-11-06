// src/index.js

const TelegramBot = require('node-telegram-bot-api');
const { performance } = require('perf_hooks');
const { solveOptimizedV2, parseCard } = require('./solver/solver.js');
const geminiService = require('./services/gemini.service.js');
const mistralService = require('./services/mistral.service.js');

// ========== HTTP Server for Render (commented while testing deployment on railway.com instead of render) ==========
// const express = require('express');
// const app = express();

// app.get('/', (req, res) => {
//     res.send('🚀 FL Solver Bot is alive and solving poker hands!');
// });

// const PORT = process.env.PORT || 10000;
// app.listen(PORT, '0.0.0.0', () => {
//     console.log(`🌐 Health check server running on port ${PORT}`);
// });

// ========== Bot Setup ==========
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

// ========== Retry Context Storage ==========
// Store image buffers and context for retry functionality
const retryContexts = new Map();

// ========== MODEL MANAGEMENT ==========

function getAllModels() {
    const geminiModels = geminiService.getAvailableModels();
    const mistralModels = mistralService.getAvailableModels();
    
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

let currentProvider = 'gemini';
let currentModelKey = 'pro';

function setCurrentModel(modelKey) {
    const allModels = getAllModels();
    const model = allModels[modelKey];
    
    if (!model) return false;
    
    currentProvider = model.provider;
    currentModelKey = modelKey;
    
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

async function identifyCardsFromImage(imageBuffer) {
    if (currentProvider === 'gemini') {
        return geminiService.identifyCardsFromImage(imageBuffer);
    } else if (currentProvider === 'mistral') {
        return mistralService.identifyCardsFromImage(imageBuffer);
    }
    throw new Error('Unknown provider');
}

// ========== UTILITY FUNCTIONS ==========

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

/**
 * Extracts cards from triple backticks in model response
 */
function extractCardsFromResponse(responseText) {
    const match = responseText.match(/```([\s\S]*?)```/);
    if (match && match[1]) {
        return match[1].trim();
    }
    return null;
}

/**
 * Extracts error message from API error object
 */
function extractErrorMessage(error) {
    // Mistral errors - extract from Body JSON
    if (error.message && error.message.includes('Body:')) {
        try {
            const bodyMatch = error.message.match(/Body: ({.*})/);
            if (bodyMatch && bodyMatch[1]) {
                const bodyObj = JSON.parse(bodyMatch[1]);
                if (bodyObj.message) {
                    return bodyObj.message;
                }
            }
        } catch (e) {
            // Continue to other checks
        }
    }
    
    // Gemini errors - look for error.message directly or nested in error object
    if (error.message) {
        // Check if it's a JSON string with nested error
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.message) {
                return parsed.error.message;
            }
        } catch (e) {
            // Not JSON, check if it's a descriptive message
            if (!error.message.includes('ApiError') && 
                !error.message.includes('SDKError') && 
                !error.message.includes('Status ') &&
                !error.message.includes('Body:')) {
                return error.message;
            }
        }
    }
    
    // Try error.error.message (nested structure)
    if (error.error && error.error.message) {
        return error.error.message;
    }
    
    // Fallback
    return 'API error occurred';
}

/**
 * Creates inline keyboard with retry options
 */
function createRetryKeyboard(currentModelKey) {
    const allModels = getAllModels();
    const buttons = [];
    
    // Add retry with current model
    buttons.push([{ text: '🔄 Retry', callback_data: 'retry_same' }]);
    
    // Add all other models
    for (const [key, model] of Object.entries(allModels)) {
        if (key !== currentModelKey) {
            buttons.push([{
                text: `${model.displayName} & Retry`,
                callback_data: `retry_${key}`
            }]);
        }
    }
    
    // Add exit button
    buttons.push([{ text: '❌ Exit', callback_data: 'retry_exit' }]);
    
    return { inline_keyboard: buttons };
}

// ========== MAIN PROCESSING FUNCTION ==========

async function processImage(chatId, imageBuffer, messageId = null) {
    try {
        bot.sendChatAction(chatId, 'typing');
        
        // Call vision API
        const responseText = await identifyCardsFromImage(imageBuffer);
        
        // Extract cards from backticks
        const cardString = extractCardsFromResponse(responseText);
        
        if (!cardString) {
            // Bad response - model didn't use backticks
            const currentModel = getCurrentModel();
            const errorMsg = `❌ ${currentModel.displayName}: Bad response`;
            
            const contextId = `${chatId}_${Date.now()}`;
            retryContexts.set(contextId, { imageBuffer, chatId });
            
            const keyboard = createRetryKeyboard(currentModelKey);
            keyboard.inline_keyboard = keyboard.inline_keyboard.map(row => 
                row.map(btn => ({
                    ...btn,
                    callback_data: `${btn.callback_data}_${contextId}`
                }))
            );
            
            if (messageId) {
                await bot.editMessageText(errorMsg, {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: keyboard
                });
            } else {
                await bot.sendMessage(chatId, errorMsg, { reply_markup: keyboard });
            }
            return;
        }
        
        // Parse cards and run solver - let solver handle validation
        const cardCodes = cardString.trim().split(/\s+/);
        const parsedCards = cardCodes.map(parseCard);
        
        // Run solver
        const startTime = performance.now();
        const { best } = solveOptimizedV2(parsedCards);
        const endTime = performance.now();
        const solveTime = ((endTime - startTime) / 1000).toFixed(3);

        if (!best) {
            throw new Error('Solver returned no valid arrangement');
        }

        // Format result
        const repeatText = best.isRepeat ? '✅ (Repeat FL)' : '';
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
*Time:* ${solveTime}s
`;
        
        if (messageId) {
            await bot.editMessageText(resultMessage, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: 'Markdown'
            });
        } else {
            await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error("Processing Error:", error);
        
        // Check if it's a solver error (bad card data)
        const currentModel = getCurrentModel();
        let errorMessage;
        
        if (error.message && (
            error.message.includes('Solver') || 
            error.message.includes('at least 13 cards') ||
            error.message.includes('valid arrangement'))) {
            errorMessage = 'Bad response';
        } else {
            // API error - extract message
            errorMessage = extractErrorMessage(error);
        }
        
        const errorMsg = `❌ ${currentModel.displayName}: ${errorMessage}`;
        
        const contextId = `${chatId}_${Date.now()}`;
        retryContexts.set(contextId, { imageBuffer, chatId });
        
        const keyboard = createRetryKeyboard(currentModelKey);
        keyboard.inline_keyboard = keyboard.inline_keyboard.map(row => 
            row.map(btn => ({
                ...btn,
                callback_data: `${btn.callback_data}_${contextId}`
            }))
        );
        
        if (messageId) {
            await bot.editMessageText(errorMsg, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: keyboard
            });
        } else {
            await bot.sendMessage(chatId, errorMsg, { reply_markup: keyboard });
        }
    }
}

// ========== BOT COMMANDS ==========

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const currentModel = getCurrentModel();
    const startMessage = `Hello! 👋 Send me a screenshot of your cards.

*Current Model:* ${currentModel.displayName}

*Commands:*
/model - Switch model
/status - View settings`;
    bot.sendMessage(chatId, startMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/solve (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const cardString = match[1];
    
    try {
        const cardCodes = cardString.trim().split(/\s+/);
        const numCards = cardCodes.length;

        if (numCards < 14 || numCards > 17) {
            bot.sendMessage(chatId, `❌ Found ${numCards} cards, need 14-17.`);
            return;
        }

        const parsedCards = cardCodes.map(parseCard);
        const invalidCards = parsedCards.filter(c => c === null);

        if (invalidCards.length > 0) {
            bot.sendMessage(chatId, `❌ Couldn't parse some cards.`);
            return;
        }

        const startTime = performance.now();
        const { best } = solveOptimizedV2(parsedCards);
        const endTime = performance.now();
        const solveTime = ((endTime - startTime) / 1000).toFixed(3);

        if (!best) {
            bot.sendMessage(chatId, "❌ No valid arrangement found");
            return;
        }

        const repeatText = best.isRepeat ? '✅ (Repeat FL)' : '';
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
*Time:* ${solveTime}s
`;
        bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Solver Error:", error);
        bot.sendMessage(chatId, "❌ Solver error occurred");
    }
});

bot.onText(/\/model/, (msg) => {
    const chatId = msg.chat.id;
    const allModels = getAllModels();
    
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

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const currentModel = getCurrentModel();
    
    const statusMessage = `*Current Settings:*

*Model:* ${currentModel.displayName}
*Provider:* ${currentModel.provider}

Use /model to switch.`;
    bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/flash/, (msg) => {
    const chatId = msg.chat.id;
    const success = setCurrentModel('flash');
    
    if (success) {
        const newModel = getCurrentModel();
        bot.sendMessage(chatId, `✅ Switched to ${newModel.displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

bot.onText(/\/pro/, (msg) => {
    const chatId = msg.chat.id;
    const success = setCurrentModel('pro');
    
    if (success) {
        const newModel = getCurrentModel();
        bot.sendMessage(chatId, `✅ Switched to ${newModel.displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

bot.onText(/\/mistrallarge/, (msg) => {
    const chatId = msg.chat.id;
    const success = setCurrentModel('mistral-large');
    
    if (success) {
        const newModel = getCurrentModel();
        bot.sendMessage(chatId, `✅ Switched to ${newModel.displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

bot.onText(/\/mistralsmall/, (msg) => {
    const chatId = msg.chat.id;
    const success = setCurrentModel('mistral-small');
    
    if (success) {
        const newModel = getCurrentModel();
        bot.sendMessage(chatId, `✅ Switched to ${newModel.displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

// ========== CALLBACK QUERY HANDLER ==========

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    // Handle model selection
    if (data.startsWith('model_')) {
        const modelKey = data.replace('model_', '');
        const success = setCurrentModel(modelKey);
        
        if (success) {
            const newModel = getCurrentModel();
            bot.answerCallbackQuery(query.id, { text: `Switched to ${newModel.displayName}` });
            bot.editMessageText(`✅ Switched to ${newModel.displayName}`, {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'Markdown'
            });
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Error switching model' });
        }
        return;
    }
    
    // Handle retry actions
    if (data.startsWith('retry_')) {
        const parts = data.split('_');
        const action = parts[1];
        const contextId = parts.slice(2).join('_');
        
        const context = retryContexts.get(contextId);
        if (!context) {
            bot.answerCallbackQuery(query.id, { text: 'Session expired, send new screenshot' });
            return;
        }
        
        if (action === 'exit') {
            bot.answerCallbackQuery(query.id, { text: 'Cancelled' });
            bot.editMessageText('❌ Cancelled', {
                chat_id: chatId,
                message_id: query.message.message_id
            });
            retryContexts.delete(contextId);
            return;
        }
        
        // Switch model if needed
        if (action !== 'same') {
            setCurrentModel(action);
        }
        
        const currentModel = getCurrentModel();
        bot.answerCallbackQuery(query.id, { text: `Retrying with ${currentModel.displayName}...` });
        
        // Update message to show processing
        bot.editMessageText(`🔄 Retrying with ${currentModel.displayName}...`, {
            chat_id: chatId,
            message_id: query.message.message_id
        });
        
        // Process image with retry
        await processImage(context.chatId, context.imageBuffer, query.message.message_id);
        
        // Clean up context
        retryContexts.delete(contextId);
    }
});

// ========== PHOTO HANDLER ==========

// bot.on('photo', async (msg) => {
//     const chatId = msg.chat.id;

//     try {
//         bot.sendChatAction(chatId, 'typing');

//         const photo = msg.photo[msg.photo.length - 1];
//         const fileStream = bot.getFileStream(photo.file_id);

//         const chunks = [];
//         for await (const chunk of fileStream) {
//             chunks.push(chunk);
//         }
//         const imageBuffer = Buffer.concat(chunks);

//         await processImage(chatId, imageBuffer);

//     } catch (error) {
//         console.error("Photo Handler Error:", error);
//         await bot.sendMessage(chatId, "❌ Error processing image");
//     }
// });

// // Add this after the photo handler

// // ========== DOCUMENT HANDLER (for uncompressed images) ==========

// bot.on('document', async (msg) => {
//     const chatId = msg.chat.id;
//     const document = msg.document;

//     // Only process image documents
//     if (!document.mime_type || !document.mime_type.startsWith('image/')) {
//         return; // Ignore non-image documents
//     }

//     try {
//         bot.sendChatAction(chatId, 'typing');

//         const fileStream = bot.getFileStream(document.file_id);

//         const chunks = [];
//         for await (const chunk of fileStream) {
//             chunks.push(chunk);
//         }
//         const imageBuffer = Buffer.concat(chunks);

//         await processImage(chatId, imageBuffer);

//     } catch (error) {
//         console.error("Document Handler Error:", error);
//         await bot.sendMessage(chatId, "❌ Error processing image");
//     }
// });

// ========== PHOTO HANDLER (compressed images) ==========

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        bot.sendChatAction(chatId, 'typing');

        const photo = msg.photo[msg.photo.length - 1];
        
        // Get file info from Telegram
        const file = await bot.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        
        // Fetch the file directly via HTTP
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        await processImage(chatId, imageBuffer);

    } catch (error) {
        console.error("Photo Handler Error:", error);
        await bot.sendMessage(chatId, "❌ Error processing image");
    }
});

// ========== DOCUMENT HANDLER (uncompressed images) ==========

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;

    // Only process image documents
    if (!document.mime_type || !document.mime_type.startsWith('image/')) {
        return;
    }

    try {
        bot.sendChatAction(chatId, 'typing');

        // Get file info from Telegram
        const file = await bot.getFile(document.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        
        // Fetch the file directly via HTTP
        const response = await fetch(fileUrl);
        const arrayBuffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(arrayBuffer);

        await processImage(chatId, imageBuffer);

    } catch (error) {
        console.error("Document Handler Error:", error);
        await bot.sendMessage(chatId, "❌ Error processing image");
    }
});

console.log('🚀 FL Solver Bot is running!');

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});