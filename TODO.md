# To do next:

### Better error handling/displaying:

Replace this message: "An error occurred while processing your image. Please try again" With appropiate vision API error or custom feedback depending on the error.

We're gonna fetch the error code code, and write appropiate message/bot action for the given error. For example if a model triggers code 503:

Error calling Gemini API: ApiError: {"error":{"code":503,"message":"The model is overloaded. Please try again later.","status":"UNAVAILABLE"}}

Bot sends messgae: "The {currentModel} is overloaded. Retrying with {next Model in the list}"

Then switch to the next model & pass screenshot again. 

The vision models in order of preference if no errors are:
gemini 2.5 pro (default)
gemini flash (option 2)
mistral large (option 3)

___ 

Next time I get other errors I will write them down right away & decide exactly how i want to handle them. For now lets write the logic for switching models & retry screenshot on error 503, just keep in mind we'll add more error handling in the future so keep the code easy to read, edit & extend.


Just thinking out laud here. Notes to self for later... Types errors:
Telegram API (I dont think i ever got a telegram error on this bot)
Gemini API (most common: 'model overloaded', and 'exceeded number of free requests', we'll switch to another model if overloaded or switch API key maybe if i hit limit of free requests. I'll think about exactly how to handle that.)
Mistral API ('exceeded number of free requests', we'll need to either switch to another model or switch API key. I'll think about exactly how to handle this.)
Solver (invalid input, which means the vision model didnt output the cards as instructed, which means we want to retry. I'll think about exactly how to handle the model selection when this happens)

Is all the error messages & handling in the index.js or is it spread on other files too? I want to get it organized if it isnt.

