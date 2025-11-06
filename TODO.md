================= DOING / TESTING =========================

- Now depolying to railway.com instedad of render (fixed speed issue during solver function)

================= TO DO NEXT =========================

1. This telegram message error: `❌ Error processing image` triggers for different reasons. I see in the console sometimes its telegram error & sometimes node errors I think. Here's a recent one:
```
Photo Handler Error: Error [ERR_STREAM_PREMATURE_CLOSE]: Premature close
    at PassThrough.onclose (node:internal/streams/end-of-stream:166:30)
    at PassThrough.emit (node:events:531:35)
    at emitCloseNT (node:internal/streams/destroy:148:10)
    at process.processTicksAndRejections (node:internal/process/task_queues:89:21) {
  code: 'ERR_STREAM_PREMATURE_CLOSE'
}
```

In any case this error message triggers way too much, its defs not normal. its not about automating retries, its about figuring out exactly why this fails so much.

2. Currently bot only processes images if telegram sends them compressed. But if i chose to send it uncompressed with the telegram app for more quality, the image is not detected. The bot needs to get any file thats png or jpg, compressed or uncompressed, do the base64, and pass to the vision-language model. Maybe we can rethink the whole photo handler approach and replace it with:



encode_image(screenshot)
- get file extension
- if "jpg" or "jpeg": 
    - encode based64 image
    - make variables: base64data=base64data & img_type="image/jpeg"
    - return base64data & img_type
- if "png":
    - encode based64 image
    - make variables: base64data=base64data & img_type="image/png"
    - return base64data & img_type

main loop:
- encode image
- 

def main():
    updater = Updater(token=bot_token, use_context=True)
    dp = updater.dispatcher

    dp.add_handler(MessageHandler(Filters.photo, get_photo))
    dp.add_handler(MessageHandler(Filters.text, handle_text))

    updater.start_polling()

    keep_alive_thread = threading.Thread(target=keep_alive)
    keep_alive_thread.daemon = True
    keep_alive_thread.start()

    updater.idle()
    updater.stop()

if __name__ == '__main__':
    main()
    const contents = [
        {
            role: 'user',
            parts: [
                {
                    inlineData: {
                        mimeType: 'image/jpeg',
                        data: imageBuffer.toString("base64"),
                    },
                },
            ],

def encode_img(photo):
    image_data = photo.getvalue()
    file_extension = photo.name.split(".")[-1].lower()
    encoded_image = base64.b64encode(image_data).decode()

    if file_extension in ["jpg", "jpeg"]:
        media_type = "image/jpeg"

    elif file_extension == "png":
        media_type = "image/png"

    else:
        media_type = None

    return encoded_image, media_type