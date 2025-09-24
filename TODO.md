### FL Solver Bot v2.0 - Development Checklist

#### Phase 1: Project Structure & Setup (The Foundation)
*   [ ] **1. Reorganize File Structure:** Create the `src` directory and the subdirectories we planned: `src/solver`, `src/services`, `src/image`, and `src/image/assets`.
*   [ ] **2. Move Existing Code:** Move the current `index.js` logic into a new file at `src/index.js`.
*   [ ] **3. Update `package.json`:** Change the `"main"` entry to `"src/index.js"` so Replit runs the correct file.
*   [ ] **4. Install New Dependencies:** We'll need libraries for Gemini, image manipulation, and environment variable management.
    ```bash
    npm install @google/generative-ai sharp dotenv
    ```
#### Phase 2: Integrate the Solver (The Brains)
*   [ ] **1. Create Solver Module:** Create the file `src/solver/solver.js`.
*   [ ] **2. Port the JS Solver:** Copy the entire `solveOptimizedV2` function and all its helper functions (`evalHand`, `compareHands`, `getRoyalties`, etc.) directly into `src/solver/solver.js`.
*   [ ] **3. Export the Solver:** At the end of the file, export the main function so other parts of the app can use it: `module.exports = { solveOptimizedV2 };`.

#### Phase 3: Handle Image Input (The Eyes)
*   [ ] **1. Listen for Photos:** In `src/index.js`, modify the bot logic to listen for photos instead of just text. Use `bot.on('photo', async (msg) => { ... });`.
*   [ ] **2. Add User Feedback:** Inside the photo listener, immediately send a "thinking" message to the user, like `bot.sendMessage(chatId, 'Got it! Analyzing your cards... 🤖');`.
*   [ ] **3. Download the Image:** Within the listener, get the highest resolution photo's `file_id` and use `bot.getFileStream(file_id)` to download the image data into a buffer. This buffer is what we'll send to Gemini.

#### Phase 4: Gemini Vision Integration (The Recognition)
*   [ ] **1. Create Gemini Service:** Create the file `src/services/gemini.service.js`.
*   [ ] **2. Write Card Identification Logic:** Create an async function `identifyCardsFromImage(imageBuffer)` inside this service. This function will:
    *   Initialize the Gemini client.
    *   Contain the specific prompt to ask Gemini to return a JSON array of card strings (e.g., `["AS", "KD", "TC", ...]`).
    *   Make the API call to Gemini 1.5 Pro with the image and prompt.
    *   Parse the JSON response.
    *   Include robust error handling in case Gemini's output isn't valid JSON.
*   [ ] **3. Connect to Bot:** In `src/index.js`, after downloading the image buffer, call this new `identifyCardsFromImage` function.

#### Phase 5: Generate the Solution Image (The Hands)
*   [ ] **1. Create Image Assets:** Create the `src/image/assets/cards` directory. You will need to populate this with 52 PNG images, named `AS.png`, `KC.png`, etc. Also add a `background.png`.
*   [ ] **2. Create Image Generator:** Create the file `src/image/generator.js`.
*   [ ] **3. Write Image Generation Logic:** Create an async function `createSolutionImage(solverResult)` that uses the `sharp` library to:
    *   Load the `background.png`.
    *   Iterate through the `front`, `middle`, `back`, and `discards` arrays from the solver's result.
    *   For each card string, load the corresponding PNG from `assets/cards`.
    *   Use `sharp.composite()` to place each card image at predefined coordinates on the background.
    *   (Optional Stretch Goal) Draw text for labels and the final score onto the image.
    *   Return the final image as a buffer.

#### Phase 6: Final Assembly & Error Handling (The Full Loop)
*   [ ] **1. Orchestrate the Full Flow:** In the `bot.on('photo', ...)` handler in `src/index.js`, chain all the steps together inside a `try...catch` block:
    1.  Download image buffer.
    2.  Call Gemini service -> get cards array.
    3.  Call Solver -> get solution object.
    4.  Call Image Generator -> get final image buffer.
    5.  Send the final image to the user with `bot.sendPhoto(chatId, imageBuffer, { caption: 'Here is the optimal arrangement!' });`.
*   [ ] **2. Implement Graceful Error Handling:** In the `catch` block, send a user-friendly error message. For example: "Sorry, I couldn't read the cards in that image. Please try a clearer screenshot." or "An unexpected error occurred. Please try again."