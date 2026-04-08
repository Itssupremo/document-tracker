# QR Document System

A full-stack web application that uploads Word documents (.docx), embeds a generated QR code, converts to PDF, and provides secure PIN-based access through QR scanning.

## Features

- **File Upload** – Upload `.docx` files with uploader metadata
- **QR Code Generation** – Auto-generates QR code linking to the file access page
- **QR Embedding** – Replaces `{{qr}}` placeholder in the DOCX with the QR code image
- **PDF Conversion** – Converts the modified DOCX to PDF via LibreOffice CLI
- **PIN Security** – Each upload gets a unique 6-digit PIN for PDF access
- **Token Auth** – PIN verification returns a 30-minute access token
- **QR Scanner** – Camera-based QR scanner using `html5-qrcode`

## Tech Stack

| Component      | Technology                               |
|----------------|------------------------------------------|
| Backend        | Node.js + Express                        |
| File Upload    | Multer                                   |
| QR Code        | qrcode                                   |
| DOCX Editing   | docxtemplater + pizzip + image module    |
| PDF Conversion | LibreOffice CLI (headless)               |
| Database       | SQLite (better-sqlite3)                  |
| Frontend       | HTML + Bootstrap 5 + Vanilla JS          |
| Security       | Helmet, rate-limiting, PIN + token auth  |

## Prerequisites

1. **Node.js** (v18 or later)
2. **LibreOffice** (required for DOCX → PDF conversion)
   - **Windows**: Download from https://www.libreoffice.org/download/
   - **macOS**: `brew install --cask libreoffice`
   - **Linux (Ubuntu/Debian)**: `sudo apt install libreoffice`

## Setup

```bash
# 1. Navigate to project directory
cd QR-code

# 2. Install dependencies
npm install

# 3. Configure environment (edit .env as needed)
# Default .env is already created with:
#   PORT=3000
#   BASE_URL=http://localhost:3000
#   PIN_SECRET=1234
#   SESSION_SECRET=change-this-to-a-random-secure-string-in-production

# 4. Start the server
npm start

# Or with auto-reload for development:
npm run dev
```

## Usage

### 1. Prepare a Word Document

Create a `.docx` file with the placeholder `{{qr}}` where you want the QR code to appear. Example:

```
Document Title

This document was verified. Scan the QR code below:

{{qr}}
```

### 2. Upload

1. Open http://localhost:3000
2. Enter your name and (optional) email
3. Select your `.docx` file
4. Click "Upload & Generate QR"
5. **Save the 6-digit PIN** displayed — it's needed to access the PDF

### 3. Access via QR

- Scan the QR code with the Scanner page (http://localhost:3000/scanner) or any QR reader
- The QR leads to the file details page
- Enter the PIN to view or download the PDF

## API Endpoints

| Method | Endpoint              | Description                           |
|--------|-----------------------|---------------------------------------|
| POST   | `/api/upload`         | Upload DOCX, embed QR, generate PDF   |
| GET    | `/file/:id`           | Get file metadata (public)            |
| POST   | `/file/:id/verify`    | Verify PIN, receive access token      |
| GET    | `/file/:id/pdf`       | View PDF (requires token)             |
| GET    | `/file/:id/download`  | Download PDF (requires token)         |
| GET    | `/api/qr/:fileId`     | Get QR code image                     |

## Project Structure

```
QR-code/
├── server.js              # Express app entry point
├── package.json
├── .env                   # Environment configuration
├── config/
│   └── db.js              # SQLite database setup
├── middleware/
│   ├── auth.js            # PIN verification + token auth
│   └── upload.js          # Multer file upload config
├── routes/
│   ├── upload.js          # POST /api/upload
│   ├── file.js            # GET /file/:id, PIN verify, PDF serve
│   └── qr.js              # GET /api/qr/:fileId
├── services/
│   ├── qrService.js       # QR code generation
│   ├── docxService.js     # DOCX templating + QR embedding
│   └── pdfService.js      # LibreOffice PDF conversion
├── public/
│   ├── index.html         # Upload page
│   ├── file-details.html  # File details + PIN verification
│   ├── scanner.html       # QR camera scanner
│   ├── css/style.css
│   └── js/
│       ├── app.js         # Upload page logic
│       ├── file-details.js # File details page logic
│       └── scanner.js     # QR scanner logic
├── uploads/               # Raw uploaded DOCX files
├── output/                # Modified DOCX + generated PDFs
└── qrcodes/               # Generated QR code images
```

## Security

- **Helmet** – HTTP security headers
- **Rate limiting** – 20 uploads / 100 API requests per 15 min
- **No direct file access** – Files served only through authenticated routes
- **PIN + Token** – 6-digit PIN grants a 30-minute access token
- **File validation** – Only `.docx` MIME type accepted, 20MB max
- **Input sanitization** – All user inputs validated server-side

## Troubleshooting

- **"PDF conversion failed"** → Ensure LibreOffice is installed and `soffice` is in your PATH
- **"Failed to embed QR code"** → Make sure your DOCX contains the exact text `{{qr}}`
- **"Only .docx files allowed"** → Ensure the file has a `.docx` extension and proper MIME type
