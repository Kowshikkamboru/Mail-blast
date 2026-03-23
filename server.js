const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Serve Vite build output in production
const distPath = path.join(__dirname, "dist");
const fs = require("fs");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.use(express.static(path.join(__dirname)));
}

// Send email endpoint
app.post("/api/send", async (req, res) => {
  const { senderEmail, appPassword, to, toName, fromName, subject, body, replyTo, resumeName, resumeBase64 } = req.body;

  if (!senderEmail || !appPassword || !to || !subject || !body) {
    return res.status(400).json({ error: "Missing required fields: senderEmail, appPassword, to, subject, body" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: appPassword,
      },
    });

    const mailOptions = {
      from: `"${fromName || senderEmail}" <${senderEmail}>`,
      to,
      subject,
      text: body,
      replyTo: replyTo || senderEmail,
    };

    // Attach resume PDF if provided
    if (resumeName && resumeBase64) {
      mailOptions.attachments = [
        {
          filename: resumeName,
          content: resumeBase64,
          encoding: "base64",
        },
      ];
    }

    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error("Send error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Test SMTP connection
app.post("/api/test-connection", async (req, res) => {
  const { senderEmail, appPassword } = req.body;

  if (!senderEmail || !appPassword) {
    return res.status(400).json({ error: "Missing senderEmail or appPassword" });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: senderEmail,
        pass: appPassword,
      },
    });

    await transporter.verify();
    res.json({ success: true, message: "SMTP connection OK" });
  } catch (err) {
    console.error("Connection test error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Mail Blast server running at http://localhost:${PORT}`);
});
