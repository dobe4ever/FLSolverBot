Loved the test list! Tested everything & everything works as expected in terms of what the code is supposed to do. However, compressed images are not always read accurately by the model:
🧪 Testing Checklist:
* `/start` command shows correct model and API key number: ✅
* Uncompressed images (documents) process correctly: Always accurate response ✅
* Error messages are clear and helpful ✅

Pending:
* API key rotation works and notifies user: We'll see when we get the error ❓
* Compressed photos: Code works but VLM response not always accurate. We will leave both options for now, so it listens to compressed & uncompressed. I'll use compressed to save tokens & manually resend uncompressed in the rare occasion when it gets it wrong.

🧪More Testing (During poker session):
thinking Level: 'MINIMAL' ✅
thinking Level: 'LOW'
thinking Level: 'MEDIUM'
thinking Level: 'HIGH'
'MEDIA_RESOLUTION_HIGH'✅
'MEDIA_RESOLUTION_DEFAULT'
'MEDIA_RESOLUTION_LOW'
'MEDIA_RESOLUTION_MEDIUM'
API key rotation works and notifies user: We'll see when we get the error (occasionally) ⚠️