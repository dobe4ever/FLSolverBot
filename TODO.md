# PLAN FOR V2 (REFACTOR):
- Create files: 
'src/configs.js' (data to access ai client, model, & options. The idea is to be able to add/remove AI clients/models/options frm a single place & have it added to telegram automatically so I can set the model from the /models command)

- Replace: 'src/service/gemini.service.js', 'src/service/mistral.js' & 'identifyCardsFromImage()'
- With: 'src/configs.js', 'src/ai/generate.js', 'generate()' (Details below)

- Replace: 'identifyCardsFromImage' with: 'generate':
-- Create file: 'src/ai/generate.js'
-- Write func: 'generate(client, model, options, msg)' (Single chat completion func that works with any AI provider, model and can take image or text or both, whatever the user sends, it generates the response. Handle the image to base64 in that module: 'src/ai/generate.js')
-- Delete 'identifyCardsFromImage' and all its references from 'index.js'
-- Import & use 'generate()' from 'src/ai/generate.js' instead

- Move & refactor:
'getAllModels()',
'setCurrentModel()',
'getCurrentModel()',
- from: 'src/index.js'
- to: 'src/ai/settings.js' (maybe? not sure exactly yet)

- Write configs:
```
// src/configs.js

// Im thinking something like so it can be accessed by the telegram commands & to set the chosen model then use the variables accordingly in the generate(). So we only need a general generate() func for any client, model, options, message

// Also, adding object for new client, should add them to the telegram options under the /models command

// OPTIONS
const System = '...'
const temperature = 0
// add more API options here in the future

// CLIENTS
const Client = {
    'mistral': {
        client: '...',
        endpoint: '...',
        apiKey: '...',
        models: ['...', '...']
    },
    'gemini': {
        client: '...',
        endpoint: '...',
        apiKey: '...',
        models: ['...', '...']
    },
    // Add AI clients in the future
};
```
- Simplify 'main()':
main loop: 'telegram message —> chat completion —> solver —> bot reply'

# GENERAL IDEA

We want a solid multi model/multi agent setup so that we can add/remove models & options from a single place. You know these AI models all have very similar APIs. Im thinking how to structure it:

CLIENT OBJECT (API setup - Same on all models): 
client: i,e: mistral, google, openai, anthropic, etc
endpoint: i,e: https://api.mistral.ai/v1/chat/completions
api key: '...'
model name: i,e: ['mistral-large-2411', 'mistral-small-latest']


OPTIONS OBJECT (Common API options for AI models):
- Same data type & same key-value naming on all models:
For example: temperature=int. Text part of the message object=string. Image url part of the message object=base64, etc.

- Same data different structure/naming/schema:
For example, some models take the system prompt as a separate string, while others need it to be inside the message object with role 'system'

- Options specific to the model or series of models:
For example google models have the thinkingbudget, media_resolution and other things.

CONSIDER EVERYTHING IN ADVANCED BASED ON DIFFERENT API REQUIREMENTS:
For example, maybe 'vision support: true/false' attached to each model? Idk just hignking out laud. So far all models have vision cause we're working on the vision feature but maybe in the future we want to add a text models or an audio model, with a specific system prompt or specific tools for other tasks. That's what i want, a multi model/multi agent set up. Maybe we should use 'function calling' with JSON mode, so the model outputs the data ready to call whatever func? so far we only have the solver func, but maybe we want to organize a file with the function definitions & schema, and have the model 'call them', instead of extracting from backticks, parsing, blah blah?

OFFICIAL API REQUIREMENTS:
I will find the exact details in the official api docs, make sure you ask me to find it before planning, cause we need to plan around it these 'chatcompletion' api structures before wirting any code.

STEPS:
1. Confirm you understand the mission at hand
2. Gather necesary info. 
3. Ask for clarifications (if needed)
4. Discuss the plan in plain english first before writing any code

Be concise!