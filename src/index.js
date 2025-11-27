// src/index.js

// IMPORTED MODULES:
const TelegramBot = require('node-telegram-bot-api');
const geminiService = require('./services/gemini.service.js');
const mistralService = require('./services/mistral.service.js');
const { solver } = require('./solver/solver.js');

// ENV VARIABLES
const token = process.env.TELEGRAM_BOT_TOKEN;

// BOT
const bot = new TelegramBot(token, { polling: true });

// DEFAULTS
let currentProvider = 'gemini';
let currentModelKey = 'pro';

// Stores image buffers and chat IDs to allow retrying with different models
const retryContexts = new Map();

// FUNCTION DEF:
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

function parseResponse(responseText) {
    // CONSTANTS FOR PARSING:
    const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
    const SUITS = ["♠️", "❤️", "🔷", "🟢"];
    const SUIT_MAP = { "♠️": 0, "❤️": 1, "🔷": 2, "🟢": 3, S: 0, H: 1, D: 2, C: 3 };

    // 1. Extract content between backticks
    const match = responseText.match(/```([\s\S]*?)```/);
    if (!match || !match[1]) return null;

    const cardString = match[1].trim();
    const cardCodes = cardString.split(/\s+/);

    // 2. Parse into objects
    const parsedCards = cardCodes.map(code => {
        if (!code || code.length < 2) return null;
        const c = code.trim().toUpperCase();
        const r = c[0];
        const sRaw = c.slice(1);
        const rank = RANKS.indexOf(r);
        const suit = SUIT_MAP[sRaw];
        
        if (rank === -1 || suit === undefined) return null;
        return { rank, suit, str: r + SUITS[suit] };
    }).filter(c => c !== null);

    // Basic validation: Solver needs at least 13 cards
    if (parsedCards.length < 13) return null;

    return parsedCards;
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

// BOT COMMANDS:
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

bot.onText(/\/models/, (msg) => {
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

// CALLBACK QUERY HANDLER:
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
        await main(context.chatId, context.imageBuffer, query.message.message_id);
        retryContexts.delete(contextId);
    }
});

// PHOTO HANDLER (COMPRESSED IMG):
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

// PHOTO HANDLER (UNCOMPRESSED IMG):
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
        await main(chatId, imageBuffer);
    } catch (error) {
        console.error("Document Handler Error:", error);
        await bot.sendMessage(chatId, "❌ Error processing image file.");
    }
});

// MAIN PROCESSING FUNCTION:
// REPLACE YOUR EXISTING main FUNCTION WITH THIS
async function main(chatId, imageBuffer, messageId = null) {
    try {
        // 0. Typing action
        bot.sendChatAction(chatId, 'typing');
        
        // 1. Get raw text from VLM
        const responseText = await identifyCardsFromImage(imageBuffer);
        
        // 2. Parse text directly into solver-ready objects
        const parsedCards = parseResponse(responseText);

        // 3. Validate parsed cards
        if (!parsedCards) {
            const currentModel = getCurrentModel();
            const errorMsg = `❌ ${currentModel.displayName}: Bad response (Could not extract cards)`;
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
        
        // 4. Solve and get the formatted message string
        const { solutionMessage } = solver(parsedCards);

        // 5. Reply with the solution
        if (messageId) {
            await bot.editMessageText(solutionMessage, { chat_id: chatId, message_id: messageId, parse_mode: 'Markdown' });
        } else {
            await bot.sendMessage(chatId, solutionMessage, { parse_mode: 'Markdown' });
        }

    } catch (error) {
        console.error("Processing Error:", error);
        const currentModel = getCurrentModel();
        let errorMessage;
        // Check for solver-specific errors
        if (error.message && (error.message.includes('Solver') || error.message.includes('at least 13 cards'))) {
            errorMessage = 'Solver Error: ' + error.message;
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

console.log('🚀 FL Solver Bot is running!');

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});