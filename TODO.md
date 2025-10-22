# To do next:

### Better error handling/displaying:

ERROR CATEGORIES:
- Telegram API
- Solver
- Couldn't call the vision API
- Model gave bad response

we can simplify this and have just one generic message in each category:

With te solver function, I never got any errors. If anything goes wrong during the actual solving, we can just send a bot message on telegram saying: "Something went wrong with the solver" (This has never happened. If it happens one day I'll debug from there)
- Same with telegram, never had any issues with the telegram API. No need to change anything related to telegram errors.

The errors i get most are with the vision API calls. Here's the 2 types i get:
- Error calling Gemini API: ApiError: {"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}

- Error calling Mistral API: SDKError: API error occurred: Status 429
Body: {"object":"error","message":"Service tier capacity exceeded for this model.","type":"service_tier_capacity_exceeded","param":null,"code":"3505"}

- I also get the 'tier capacity exceeded' error with google models sometimes, not sure what the code & details is for those right now...

- And sometimes small models gives bad output.

Here's the appropriate action for each kind of error:

- if Mistral free tier exceeded: Switch model & retry, or quit
- If gemini pro tier exceeded: Switch model & retry, switch API key & retry, or quit (I just a new gemini key, so we can use two. They reset daily so we can alternate if one hits the limit)
- if model bad output: retry, switch model and retry, or quit

We only need one generic message:

"{current model name here}, {error message fetched from the API here or "bad response"} (options as inline buttons for the user to click)" 

Here's all the possible options, we'll show only the appropriate ones based on the particular error:
[retry]
[set gemini pro & retry]
[set gemini flash & retry]
[set mistral large & retry]
[set mistral small & retry]
[swap API key & retry] (I already added the second gemini key to the secrets as 'GEMINI_API_KEY_2')
[quit] (exit without changing anything so the bot is ready for the next screenshot)

Once the user clicks an option, then, do the thing automatically so the user doesnt have to resend the screenshot manually etc...

Im thinking, remove all this duplicate code from the mistral & gemini service files:

```
        // Extract the content from between the triple backticks
        const match = responseText.match(/\`\`\`([\s\S]*?)\`\`\`/);

        if (match && match[1]) {
            // Return the cleaned, trimmed string of cards
            return match[1].trim();
        } else {
            console.error("Mistral response did not contain the expected format:", responseText);
            return null;
        }

    } catch (error) {
        console.error("Error calling Mistral API:", error);
        throw new Error("Failed to get a valid response from the vision model.");
    }
```

Handle the response extraction once in the photo handler along with all possible errors:
```
// --- Photo Handler (for image input) ---
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    try {
        // Let the user know the bot is working
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

        // Call the appropriate vision service to identify cards
        const cardStringFromVision = await identifyCardsFromImage(imageBuffer);

//// HANDLE ERROR IF CAN'T CALL THE VISION API
//// ELSE
//// EXTRACT RESPONSE FROM THE TRIPLE BACKTICKS
//// HANDLE ERROR IF BAD RESPONSE
//// ELSE
//// Run the solver with the identified cards and send the final reply
//// HANDLE ERROR SOLVER FAILS
//// ELSE
//// FORMAT SOLUTION NICELY
//// AND SEND IT AS THE BOT REPLY

});
```

Something like that...?