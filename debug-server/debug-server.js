const express = require("express");
const app = express();
const port = 3000;

// GET route that takes a string and prints it
app.get("/print", (req, res) => {
    const { message } = req.query; // Get the 'message' query parameter
    if (message) {
        console.log(message);
        res.send(`Message received: ${message}`);
    } else {
        res.send("No message received");
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
