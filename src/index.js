// src/index.js

const TelegramBot = require('node-telegram-bot-api');

// ...Render fix...
const http = require('http');

const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('FL Solver Bot is running!\n');
});

server.listen(PORT, () => {
    console.log(`🌐 HTTP server running on port ${PORT}`);
});
// ...Finish render fix...

const { performance } = require('perf_hooks');
const { solveOptimizedV2, parseCard } = require('./solver/solver.js');
const { identifyCardsFromImage } = require('./services/gemini.service.js');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
    console.error('Error: TELEGRAM_BOT_TOKEN is not set!');
    process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set!');
    process.exit(1);
}

let bot;
if (process.env.TELEGRAM_WEBHOOK_URL) {
    bot = new TelegramBot(token, { webHook: { port: PORT } });
    bot.setWebHook(`${process.env.TELEGRAM_WEBHOOK_URL}/${token}`);
} else {
    bot = new TelegramBot(token, { polling: true });
}

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
            bot.sendMessage(chatId, `❌ *Error:* I found ${numCards} cards, but I can only solve for 14, 15, 16, or 17. Please try a clearer screenshot.`);
            return;
        }

        const parsedCards = cardCodes.map(parseCard);
        const invalidCards = parsedCards.filter(c => c === null);

        if (invalidCards.length > 0) {
            bot.sendMessage(chatId, `❌ *Error:* I couldn't understand some of the cards identified. The model might have made a mistake. Please try again.`);
            return;
        }

        const startTime = performance.now();
        const { best } = solveOptimizedV2(parsedCards);
        const endTime = performance.now();
        const solveTime = ((endTime - startTime) / 1000).toFixed(3);

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
        bot.sendMessage(chatId, resultMessage, { parse_mode: 'Markdown' });

    } catch (error) {
        console.error("Solver Error:", error);
        bot.sendMessage(chatId, "An unexpected error occurred while solving. Please check the server logs.");
    }
}

// --- /start command ---
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const startMessage = `Hello! 👋 Welcome to the FL Solver Bot!

Just send me a screenshot of your cards, and I'll find the optimal arrangement for you.
`;
    bot.sendMessage(chatId, startMessage, { parse_mode: 'Markdown' });
});

// --- /solve command (for text input) ---
bot.onText(/\/solve (.+)/, (msg, match) => {
    runSolverAndReply(msg.chat.id, match[1]);
});

// --- Photo Handler (for image input) ---
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Let the user know the bot is working without sending a message
        bot.sendChatAction(chatId, 'typing');

        // Get the highest resolution photo
        const photo = msg.photo[msg.photo.length - 1];
        const fileStream = bot.getFileStream(photo.file_id);

        // Download the image into a buffer
        const chunks = [];
        for await (const chunk of fileStream) {
            chunks.push(chunk);
        }
        const imageBuffer = Buffer.concat(chunks);

        // Call Gemini to identify cards
        const cardStringFromGemini = await identifyCardsFromImage(imageBuffer);

        if (!cardStringFromGemini) {
            await bot.sendMessage(chatId, "Sorry, I couldn't extract the cards from that image. Please try a clearer screenshot without any obstructions.");
            return;
        }

        // Run the solver with the identified cards and send the final reply
        await runSolverAndReply(chatId, cardStringFromGemini);

    } catch (error) {
        console.error("Photo Handler Error:", error);
        await bot.sendMessage(chatId, "An error occurred while processing your image. Please try again.");
    }
});

console.log('🚀 FL Solver Bot is running and listening for commands and photos!');

bot.on('polling_error', (error) => {
    console.error('Polling error:', error.code);
});
