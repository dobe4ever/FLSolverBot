// src/index.js

const TelegramBot = require('node-telegram-bot-api');
const { performance } = require('perf_hooks');
const { solveOptimizedV2, parseCard } = require('./solver/solver.js');
const geminiService = require('./services/gemini.service.js');
const mistralService = require('./services/mistral.service.js');

// ========== HTTP Server for Railway/Render ==========
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

function extractCardsFromResponse(responseText) {
    const match = responseText.match(/```([\s\S]*?)```/);
    if (match && match[1]) {
        return match[1].trim();
    }
    return null;
}

function extractErrorMessage(error) {
    if (error.message && error.message.includes('Body:')) {
        try {
            const bodyMatch = error.message.match(/Body: ({.*})/);
            if (bodyMatch && bodyMatch[1]) {
                const bodyObj = JSON.parse(bodyMatch[1]);
                if (bodyObj.message) return bodyObj.message;
            }
        } catch (e) {}
    }
    if (error.message) {
        try {
            const parsed = JSON.parse(error.message);
            if (parsed.error && parsed.error.message) return parsed.error.message;
        } catch (e) {
            if (!error.message.includes('ApiError') && !error.message.includes('SDKError') && !error.message.includes('Status ') && !error.message.includes('Body:')) {
                return error.message;
            }
        }
    }
    if (error.error && error.error.message) return error.error.message;
    return 'API error occurred';
}

function createRetryKeyboard(currentModelKey) {
    const allModels = getAllModels();
    const buttons = [[{ text: '🔄 Retry', callback_data: 'retry_same' }]];
    for (const [key, model] of Object.entries(allModels)) {
        if (key !== currentModelKey) {
            buttons.push([{ text: `${model.displayName} & Retry`, callback_data: `retry_${key}` }]);
        }
    }
    buttons.push([{ text: '❌ Exit', callback_data: 'retry_exit' }]);
    return { inline_keyboard: buttons };
}

// ========== MAIN PROCESSING FUNCTION ==========

async function processImage(chatId, imageBuffer, messageId = null) {
    try {
        bot.sendChatAction(chatId, 'typing');
        
        const responseText = await identifyCardsFromImage(imageBuffer);
        const cardString = extractCardsFromResponse(responseText);
        
        if (!cardString) {
            const currentModel = getCurrentModel();
            const errorMsg = `❌ ${currentModel.displayName}: Bad response`;
            const contextId = `${chatId}_${Date.now()}`;
            retryContexts.set(contextId, { imageBuffer, chatId });
            const keyboard = createRetryKeyboard(currentModelKey);
            keyboard.inline_keyboard = keyboard.inline_keyboard.map(row => row.map(btn => ({ ...btn, callback_data: `${btn.callback_data}_${contextId}` })));
            
            if (messageId) {
                await bot.editMessageText(errorMsg, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
            } else {
                await bot.sendMessage(chatId, errorMsg, { reply_markup: keyboard });
            }
            return;
        }
        
        const cardCodes = cardString.trim().split(/\s+/);
        const parsedCards = cardCodes.map(parseCard);
        
        const startTime = performance.now();
        const { best } = solveOptimizedV2(parsedCards);
        const endTime = performance.now();
        const solveTime = ((endTime - startTime) / 1000).toFixed(3);

        if (!best) throw new Error('Solver returned no valid arrangement');

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
*Time:* ${solveTime}s`;
        
        if (messageId) {
            await bot.editMessageText(resultMessage, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error("Processing Error:", error);
        const currentModel = getCurrentModel();
        let errorMessage;
        if (error.message && (error.message.includes('Solver') || error.message.includes('at least 13 cards') || error.message.includes('valid arrangement'))) {
            errorMessage = 'Bad response';
        } else {
            errorMessage = extractErrorMessage(error);
        }
        const errorMsg = `❌ ${currentModel.displayName}: ${errorMessage}`;
        const contextId = `${chatId}_${Date.now()}`;
        retryContexts.set(contextId, { imageBuffer, chatId });
        const keyboard = createRetryKeyboard(currentModelKey);
        keyboard.inline_keyboard = keyboard.inline_keyboard.map(row => row.map(btn => ({ ...btn, callback_data: `${btn.callback_data}_${contextId}` })));
        
        if (messageId) {
            await bot.editMessageText(errorMsg, { chat_id: chatId, message_id: messageId, reply_markup: keyboard });
        } else {
            await bot.sendMessage(chatId, errorMsg, { reply_markup: keyboard });
        }
    }
}

// ========== BOT COMMANDS (unchanged) ==========

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
        if (parsedCards.some(c => c === null)) {
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
*Time:* ${solveTime}s`;
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
    bot.sendMessage(chatId, '*Select Vision Model:*', { parse_mode: 'Markdown', reply_markup: keyboard });
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
    if (setCurrentModel('flash')) {
        bot.sendMessage(chatId, `✅ Switched to ${getCurrentModel().displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

bot.onText(/\/pro/, (msg) => {
    const chatId = msg.chat.id;
    if (setCurrentModel('pro')) {
        bot.sendMessage(chatId, `✅ Switched to ${getCurrentModel().displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

bot.onText(/\/mistrallarge/, (msg) => {
    const chatId = msg.chat.id;
    if (setCurrentModel('mistral-large')) {
        bot.sendMessage(chatId, `✅ Switched to ${getCurrentModel().displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

bot.onText(/\/mistralsmall/, (msg) => {
    const chatId = msg.chat.id;
    if (setCurrentModel('mistral-small')) {
        bot.sendMessage(chatId, `✅ Switched to ${getCurrentModel().displayName}`, { parse_mode: 'Markdown' });
    } else {
        bot.sendMessage(chatId, '❌ Error switching model');
    }
});

// ========== CALLBACK QUERY HANDLER (unchanged) ==========

bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    if (data.startsWith('model_')) {
        const modelKey = data.replace('model_', '');
        if (setCurrentModel(modelKey)) {
            const newModel = getCurrentModel();
            bot.answerCallbackQuery(query.id, { text: `Switched to ${newModel.displayName}` });
            bot.editMessageText(`✅ Switched to ${newModel.displayName}`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: 'Markdown' });
        } else {
            bot.answerCallbackQuery(query.id, { text: 'Error switching model' });
        }
        return;
    }
    
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
            bot.editMessageText('❌ Cancelled', { chat_id: chatId, message_id: query.message.message_id });
            retryContexts.delete(contextId);
            return;
        }
        if (action !== 'same') setCurrentModel(action);
        const currentModel = getCurrentModel();
        bot.answerCallbackQuery(query.id, { text: `Retrying with ${currentModel.displayName}...` });
        bot.editMessageText(`🔄 Retrying with ${currentModel.displayName}...`, { chat_id: chatId, message_id: query.message.message_id });
        await processImage(context.chatId, context.imageBuffer, query.message.message_id);
        retryContexts.delete(contextId);
    }
});

// ========== NEW PHOTO HANDLER (for compressed images) ==========

bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const instructionMessage = `⚠️ *Please resend sceenshot!*

*UNCHECK "Compress the image"* (shown above)

Ensures accurate card detection! 🙏`;

    await bot.sendPhoto(chatId, 'https://i.ibb.co/Txb5PpMs/1info.png', {
        caption: instructionMessage,
        parse_mode: 'Markdown'
    });
});

// ========== DOCUMENT HANDLER (for uncompressed images) ==========

bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const document = msg.document;

    if (!document.mime_type || !document.mime_type.startsWith('image/')) {
        return; // Ignore non-image documents
    }

    try {
        bot.sendChatAction(chatId, 'typing');
        const fileStream = bot.getFileStream(document.file_id);
        const chunks = [];
        for await (const chunk of fileStream) {
            chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);
        await processImage(chatId, imageBuffer);
    } catch (error) {
        console.error("Document Handler Error:", error);
        await bot.sendMessage(chatId, "❌ Error processing image file.");
    }
});

console.log('🚀 FL Solver Bot is running!');

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});