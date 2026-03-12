const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUpload() {
    console.log("Creating dummy file...");
    const dummyPath = path.join(__dirname, 'dummy.webm');
    fs.writeFileSync(dummyPath, "dummy data here");

    console.log("Sending to python server...");
    const fileBuffer = fs.readFileSync(dummyPath);
    const form = new FormData();
    form.append('audio', fileBuffer, {
        filename: 'dummy.webm',
        contentType: 'audio/webm'
    });
    try {
        const response = await axios.post('http://127.0.0.1:8765/transcribe', form, {
            headers: {
                ...form.getHeaders()
            }
        });
        console.log("Response:", response.data);
    } catch (error) {
        console.error("Axios Error:", error.message);
        if (error.response) console.error("Data:", error.response.data);
    }

    fs.unlinkSync(dummyPath);
}

testUpload();
