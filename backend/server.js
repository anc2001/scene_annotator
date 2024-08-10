const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors'); // Import cors
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.REACT_APP_API_PORT || 5001;

app.use(cors()); // Use cors middleware
app.use(bodyParser.json({ limit: '50mb' }));

app.post('/save', (req, res) => {
  const { image, folderName } = req.body;
  const base64Data = image.replace(/^data:image\/png;base64,/, '');
  const masksDir = path.join(__dirname, 'masks');

  if (!fs.existsSync(masksDir)) {
    fs.mkdirSync(masksDir);
  }

  const filePath = path.join(masksDir, `${folderName}.png`);

  fs.writeFile(filePath, base64Data, 'base64', (err) => {
    if (err) {
      console.error('Error saving the image:', err);
      res.status(500).send('Error saving the image');
    } else {
      res.status(200).send('Image saved successfully');
    }
  });
});

app.get('/check', (req, res) => {
  const { folderName } = req.query;
  const filePath = path.join(__dirname, 'masks', `${folderName}.png`);

  if (fs.existsSync(filePath)) {
    res.status(200).json({ exists: true });
  } else {
    res.status(200).json({ exists: false });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
