const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the root directory
app.use(express.static(__dirname));

// Fallback route for single page static layout
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start local dev server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Samskara FIFA Prediction local dev server running!`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
