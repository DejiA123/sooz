import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Enable CORS so the React app (port 8080) can upload here
app.use(cors());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Keep extension, unique name
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// No file size limit (Infinity), or set to something huge like 10GB
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 * 1024 } // 10GB Limit
});

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Return the URL to access the file
    // Assuming server runs on localhost:3000
    const fileUrl = `http://localhost:${port}/uploads/${req.file.filename}`;

    console.log(`File uploaded: ${req.file.filename} (${req.file.size} bytes)`);
    res.json({ url: fileUrl, type: req.file.mimetype });
});

app.listen(port, () => {
    console.log(`Local Upload Server running at http://localhost:${port}`);
    console.log(`- Uploads enabled (Max 10GB)`);
    console.log(`- Serving files at http://localhost:${port}/uploads`);
});
