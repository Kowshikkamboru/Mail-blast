import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Analytics } from "@vercel/analytics/react";

const STEPS = ["Profile", "Email Setup", "Companies", "Generate & Send"];

const defaultProfile = {
  name: "",
  email: "",
  phone: "",
  roles: "",
  portfolioLink: "",
  linkedIn: "",
  github: "",
  about: "",
};

const statusColors = {
  ready: "#f0b429",
  sending: "#60a5fa",
  sent: "#34d399",
  failed: "#f87171",
  pending: "#6b7280",
};

const statusLabels = {
  ready: "Ready",
  sending: "Sending...",
  sent: "✓ Sent",
  failed: "✗ Failed",
  pending: "Pending",
};

export default function App() {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState(defaultProfile);
  const [emailConfig, setEmailConfig] = useState({
    senderEmail: "",
    appPassword: "",
  });
  const [smtpVerified, setSmtpVerified] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [emails, setEmails] = useState({});
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [sendProgress, setSendProgress] = useState({});
  const [sending, setSending] = useState(false);
  const [activePreview, setActivePreview] = useState(null);
  const [editingEmail, setEditingEmail] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [resumePdf, setResumePdf] = useState(null);
  const fileRef = useRef();
  const resumeRef = useRef();

  const showToast = (msg, type = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        const mapped = data.map((row) => ({
          company: row.company || row.Company || row.COMPANY || "",
          contact: row.contact || row.Contact || row.CONTACT || row.name || row.Name || "",
          email: row.email || row.Email || row.EMAIL || "",
          designation: row.designation || row.Designation || row.role || row.Role || "HR",
          industry: row.industry || row.Industry || "",
        }));
        setCompanies(mapped.filter((r) => r.email));
        showToast(`${mapped.filter((r) => r.email).length} companies loaded ✓`, "success");
      } catch {
        showToast("Failed to parse Excel. Check format.", "error");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseExcel(file);
  }, []);

  const handleResumePdf = (file) => {
    if (!file || file.type !== "application/pdf")
      return showToast("Please upload a PDF file!", "error");
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(",")[1];
      setResumePdf({ name: file.name, base64 });
      showToast(file.name + " uploaded ✓", "success");
    };
    reader.readAsDataURL(file);
  };

  const downloadTemplate = () => {
    const sample = [
      { company: "Google", contact: "Priya Sharma", email: "priya@example.com", designation: "HR Manager", industry: "Tech" },
      { company: "Swiggy", contact: "Ravi Kumar", email: "ravi@example.com", designation: "CTO", industry: "Delivery" },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Companies");
    XLSX.writeFile(wb, "companies_template.xlsx");
  };

  const generateEmails = async () => {
    if (!companies.length) return showToast("No companies loaded!", "error");
    setGenerating(true);
    setGenerateProgress(0);
    const newEmails = {};

    for (let i = 0; i < companies.length; i++) {
      const company = companies[i];
      try {
        newEmails[i] = {
          subject: `Application for ${profile.roles.split(",")[0]} – ${profile.name}`,
          body: `Dear ${company.contact || "Hiring Manager"},\n\nI am writing to express my interest in joining ${company.company}. As a ${profile.roles.split(",")[0].trim()} with experience in building modern web products, I believe I can contribute meaningfully to your team.\n\n${profile.about}\n\nPortfolio: ${profile.portfolioLink}\nLinkedIn: ${profile.linkedIn}\nGitHub: ${profile.github}\nPhone: ${profile.phone}\n\nI would love the opportunity to discuss how my skills align with your needs. Please feel free to reach out at your convenience.\n\nBest regards,\n${profile.name}`,
          status: "ready",
        };
      } catch {
        newEmails[i] = {
          subject: `Application for ${profile.roles.split(",")[0]} – ${profile.name}`,
          body: `Dear ${company.contact || "Hiring Manager"},\n\nI am writing to express my interest in joining ${company.company}...\n\n[Auto-generation failed. Please edit manually.]\n\nBest regards,\n${profile.name}`,
          status: "ready",
        };
      }

      setGenerateProgress(Math.round(((i + 1) / companies.length) * 100));
      setEmails({ ...newEmails });
    }

    setGenerating(false);
    showToast("All emails generated! Review before sending.", "success");
  };

  const sendOne = async (index) => {
    const company = companies[index];
    const emailData = emails[index];
    if (!emailData) return;

    setSendProgress((p) => ({ ...p, [index]: "sending" }));

    try {
      const payload = {
        senderEmail: emailConfig.senderEmail,
        appPassword: emailConfig.appPassword,
        to: company.email,
        toName: company.contact || "Hiring Manager",
        fromName: profile.name,
        subject: emailData.subject,
        body: emailData.body,
        replyTo: profile.email || emailConfig.senderEmail,
      };

      if (resumePdf) {
        payload.resumeName = resumePdf.name;
        payload.resumeBase64 = resumePdf.base64;
      }

      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");

      setSendProgress((p) => ({ ...p, [index]: "sent" }));
      setEmails((prev) => ({ ...prev, [index]: { ...prev[index], status: "sent" } }));
    } catch (err) {
      setSendProgress((p) => ({ ...p, [index]: "failed" }));
      setEmails((prev) => ({ ...prev, [index]: { ...prev[index], status: "failed" } }));
      showToast(`Failed: ${company.company}. ${err.message}`, "error");
    }
  };

  const sendAll = async () => {
    setSending(true);
    const pending = companies
      .map((_, i) => i)
      .filter((i) => emails[i]?.status !== "sent");

    for (const idx of pending) {
      await sendOne(idx);
      await new Promise((r) => setTimeout(r, 200));
    }
    setSending(false);
    showToast("Blast complete! 🚀", "success");
  };

  const testSmtpConnection = async () => {
    if (!emailConfig.senderEmail || !emailConfig.appPassword) {
      return showToast("Fill in Gmail and App Password!", "error");
    }
    showToast("Testing SMTP connection...", "info");
    try {
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderEmail: emailConfig.senderEmail,
          appPassword: emailConfig.appPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSmtpVerified(true);
        showToast("SMTP connected! Gmail verified ✓", "success");
      } else {
        setSmtpVerified(false);
        showToast("Connection failed: " + (data.error || "Unknown error"), "error");
      }
    } catch {
      setSmtpVerified(false);
      showToast("Server not reachable. Run: npm start", "error");
    }
  };

  // ─── Styles ──────────────────────────────────────────────────────────────────
  const s = {
    app: { minHeight: "100vh", background: "#0a0c10", color: "#e2e8f0", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", padding: "0" },
    header: { borderBottom: "1px solid #1e2a3a", padding: "20px 32px", display: "flex", alignItems: "center", gap: "16px", background: "rgba(10,12,16,0.95)", position: "sticky", top: 0, zIndex: 100 },
    logo: { fontSize: "18px", fontWeight: "700", color: "#f0b429", letterSpacing: "2px", textTransform: "uppercase" },
    logoSub: { fontSize: "10px", color: "#4a5568", letterSpacing: "3px", marginTop: "2px" },
    stepper: { display: "flex", gap: "0", marginLeft: "auto", border: "1px solid #1e2a3a", borderRadius: "6px", overflow: "hidden" },
    stepBtn: (i) => ({ padding: "8px 16px", fontSize: "11px", letterSpacing: "1px", fontFamily: "inherit", background: step === i ? "#f0b429" : "transparent", color: step === i ? "#0a0c10" : step > i ? "#34d399" : "#4a5568", border: "none", borderRight: i < 3 ? "1px solid #1e2a3a" : "none", cursor: "pointer", fontWeight: step === i ? "700" : "400", transition: "all 0.2s" }),
    main: { padding: "32px", maxWidth: "900px", margin: "0 auto" },
    sectionTitle: { fontSize: "11px", letterSpacing: "3px", color: "#f0b429", textTransform: "uppercase", marginBottom: "24px", borderBottom: "1px solid #1e2a3a", paddingBottom: "12px" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" },
    label: { display: "block", fontSize: "10px", letterSpacing: "2px", color: "#4a5568", marginBottom: "6px", textTransform: "uppercase" },
    input: { width: "100%", background: "#0f1520", border: "1px solid #1e2a3a", borderRadius: "4px", padding: "10px 12px", color: "#e2e8f0", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" },
    textarea: { width: "100%", background: "#0f1520", border: "1px solid #1e2a3a", borderRadius: "4px", padding: "10px 12px", color: "#e2e8f0", fontSize: "13px", fontFamily: "inherit", outline: "none", boxSizing: "border-box", resize: "vertical", minHeight: "90px" },
    btnPrimary: { background: "#f0b429", color: "#0a0c10", border: "none", borderRadius: "4px", padding: "12px 24px", fontSize: "11px", letterSpacing: "2px", fontFamily: "inherit", fontWeight: "700", cursor: "pointer", textTransform: "uppercase", transition: "opacity 0.2s" },
    btnGhost: { background: "transparent", color: "#f0b429", border: "1px solid #f0b429", borderRadius: "4px", padding: "10px 20px", fontSize: "11px", letterSpacing: "2px", fontFamily: "inherit", fontWeight: "600", cursor: "pointer", textTransform: "uppercase" },
    btnGreen: { background: "#065f46", color: "#34d399", border: "1px solid #34d399", borderRadius: "4px", padding: "8px 16px", fontSize: "10px", letterSpacing: "1px", fontFamily: "inherit", fontWeight: "600", cursor: "pointer", textTransform: "uppercase" },
    card: { background: "#0f1520", border: "1px solid #1e2a3a", borderRadius: "8px", padding: "20px", marginBottom: "16px" },
    infoBox: { background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: "6px", padding: "16px", marginBottom: "20px", fontSize: "12px", color: "#93c5fd", lineHeight: "1.7" },
    warnBox: { background: "#1a0e00", border: "1px solid #78350f", borderRadius: "6px", padding: "16px", marginBottom: "20px", fontSize: "12px", color: "#fcd34d", lineHeight: "1.7" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
    th: { textAlign: "left", padding: "10px 12px", fontSize: "10px", letterSpacing: "2px", color: "#4a5568", textTransform: "uppercase", borderBottom: "1px solid #1e2a3a" },
    td: { padding: "10px 12px", borderBottom: "1px solid #111820", color: "#cbd5e1", verticalAlign: "middle" },
    badge: (status) => ({ display: "inline-block", padding: "2px 8px", borderRadius: "3px", fontSize: "10px", letterSpacing: "1px", fontWeight: "600", background: statusColors[status] + "22", color: statusColors[status], border: `1px solid ${statusColors[status]}44` }),
    dropZone: (over) => ({ border: `2px dashed ${over ? "#f0b429" : "#1e2a3a"}`, borderRadius: "8px", padding: "48px 32px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: over ? "#1a1200" : "#0a0d13", marginBottom: "24px" }),
    progressBar: { background: "#1e2a3a", borderRadius: "4px", height: "6px", overflow: "hidden", marginTop: "8px" },
    progressFill: (pct) => ({ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #f0b429, #fbbf24)", borderRadius: "4px", transition: "width 0.3s" }),
    modal: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
    modalBox: { background: "#0f1520", border: "1px solid #1e2a3a", borderRadius: "10px", padding: "28px", maxWidth: "600px", width: "100%", maxHeight: "80vh", overflow: "auto" },
    toast: (type) => ({ position: "fixed", bottom: "24px", right: "24px", background: type === "success" ? "#065f46" : type === "error" ? "#7f1d1d" : "#1e2a3a", border: `1px solid ${type === "success" ? "#34d399" : type === "error" ? "#f87171" : "#3a4a5a"}`, color: type === "success" ? "#34d399" : type === "error" ? "#f87171" : "#e2e8f0", padding: "12px 20px", borderRadius: "6px", fontSize: "12px", letterSpacing: "1px", zIndex: 300, fontFamily: "inherit" }),
  };

  // ─── Render Steps ────────────────────────────────────────────────────────────
  const renderProfile = () => (
    <div>
      <p style={s.sectionTitle}>{"// 01 — Your Profile"}</p>
      <div style={s.warnBox}>⚠ Fill in all details carefully. These will be used to auto-generate personalized emails for every company.</div>
      <div style={s.grid2}>
        {[
          ["name", "Full Name"],
          ["email", "Your Gmail (sender)"],
          ["phone", "Phone Number"],
          ["portfolioLink", "Portfolio URL"],
          ["linkedIn", "LinkedIn URL"],
          ["github", "GitHub URL"],
          ["resumeLink", "Resume Drive/Notion Link"],
        ].map(([key, label]) => (
          <div key={key}>
            <label style={s.label}>{label}</label>
            <input
              style={s.input}
              value={profile[key] || ""}
              onChange={(e) => setProfile((p) => ({ ...p, [key]: e.target.value }))}
              placeholder={label}
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: "16px" }}>
        <label style={s.label}>Resume PDF (will be attached to every email)</label>
        <input ref={resumeRef} type="file" accept="application/pdf" style={{ display: "none" }}
          onChange={(e) => e.target.files[0] && handleResumePdf(e.target.files[0])} />
        <div
          onClick={() => resumeRef.current.click()}
          style={{
            border: resumePdf ? "1px solid #34d39966" : "1px dashed #1e2a3a",
            borderRadius: "6px", padding: "16px 20px", cursor: "pointer",
            background: resumePdf ? "#052e1c" : "#0a0d13",
            display: "flex", alignItems: "center", gap: "14px", transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: "24px" }}>{resumePdf ? "📄" : "📁"}</span>
          <div>
            {resumePdf ? (
              <>
                <p style={{ margin: "0 0 2px 0", color: "#34d399", fontSize: "13px", fontWeight: "600" }}>{resumePdf.name}</p>
                <p style={{ margin: 0, color: "#4a5568", fontSize: "11px" }}>Click to replace</p>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 2px 0", color: "#f0b429", fontSize: "13px", fontWeight: "600" }}>Click to upload Resume PDF</p>
                <p style={{ margin: 0, color: "#4a5568", fontSize: "11px" }}>Will be attached to every email sent</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "16px" }}>
        <label style={s.label}>Roles I'm Applying For (comma-separated)</label>
        <input style={s.input} value={profile.roles} onChange={(e) => setProfile((p) => ({ ...p, roles: e.target.value }))} placeholder="Software Engineer, Full-Stack Developer" />
      </div>
      <div style={{ marginTop: "16px" }}>
        <label style={s.label}>About Me (used in email generation)</label>
        <textarea style={s.textarea} value={profile.about} onChange={(e) => setProfile((p) => ({ ...p, about: e.target.value }))} rows={4} />
      </div>
      <div style={{ marginTop: "24px", display: "flex", justifyContent: "flex-end" }}>
        <button style={s.btnPrimary} onClick={() => setStep(1)}>Next: Email Setup →</button>
      </div>
    </div>
  );

  const renderEmailSetup = () => (
    <div>
      <p style={s.sectionTitle}>{"// 02 — Gmail SMTP Setup"}</p>
      <div style={s.infoBox}>
        <strong style={{ color: "#60a5fa" }}>One-time Gmail SMTP setup:</strong><br />
        1. Go to <strong>myaccount.google.com → Security → 2-Step Verification</strong> (enable it)<br />
        2. Then go to <strong>App Passwords</strong> → generate one for "Mail" → "Other (Mail Blast)"<br />
        3. Copy the 16-character app password below (spaces are OK)<br />
        4. Click <strong>Test Connection</strong> to verify
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <label style={s.label}>Sender Gmail Address</label>
          <input style={s.input} value={emailConfig.senderEmail}
            onChange={(e) => { setEmailConfig((c) => ({ ...c, senderEmail: e.target.value })); setSmtpVerified(false); }}
            placeholder="yourname@gmail.com" type="email" />
        </div>
        <div>
          <label style={s.label}>Gmail App Password</label>
          <input style={s.input} value={emailConfig.appPassword}
            onChange={(e) => { setEmailConfig((c) => ({ ...c, appPassword: e.target.value })); setSmtpVerified(false); }}
            placeholder="xxxx xxxx xxxx xxxx" type="password" />
        </div>
      </div>
      <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
        <button style={s.btnGhost} onClick={testSmtpConnection}>⚡ Test Connection</button>
        {smtpVerified && <span style={{ color: "#34d399", fontSize: "12px", letterSpacing: "1px" }}>✓ SMTP Verified</span>}
      </div>
      <div style={{ marginTop: "16px", ...s.card }}>
        <p style={{ fontSize: "11px", color: "#4a5568", margin: "0 0 8px 0", letterSpacing: "1px" }}>HOW IT WORKS</p>
        <pre style={{ fontSize: "11px", color: "#7dd3fc", background: "#060a10", padding: "14px", borderRadius: "4px", lineHeight: "1.8", margin: 0, whiteSpace: "pre-wrap" }}>
{`Your Gmail sends directly via SMTP (Google's servers).
No third-party service needed.
App Password keeps your real password safe.
Resume PDF is attached automatically if uploaded.`}
        </pre>
      </div>
      <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between" }}>
        <button style={s.btnGhost} onClick={() => setStep(0)}>← Back</button>
        <button style={s.btnPrimary} onClick={() => {
          if (!emailConfig.senderEmail || !emailConfig.appPassword) return showToast("Fill in Gmail and App Password!", "error");
          setStep(2);
        }}>Next: Companies →</button>
      </div>
    </div>
  );

  const renderCompanies = () => (
    <div>
      <p style={s.sectionTitle}>{"// 03 — Target Companies"}</p>
      <div style={s.dropZone(dragOver)} onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current.click()}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }}
          onChange={(e) => e.target.files[0] && parseExcel(e.target.files[0])} />
        <div style={{ fontSize: "32px", marginBottom: "12px" }}>📊</div>
        <p style={{ color: "#f0b429", fontSize: "13px", fontWeight: "700", margin: "0 0 6px 0" }}>Drop Excel / Click to Upload</p>
        <p style={{ color: "#4a5568", fontSize: "11px", margin: 0 }}>Supported: .xlsx, .xls — Required columns: company, contact, email, designation</p>
      </div>

      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <button style={s.btnGhost} onClick={downloadTemplate}>↓ Download Template</button>
        <button style={s.btnGhost} onClick={() => setCompanies((c) => [...c, { company: "", contact: "", email: "", designation: "HR", industry: "" }])}>+ Add Row</button>
        {companies.length > 0 && <span style={{ marginLeft: "auto", fontSize: "12px", color: "#34d399", alignSelf: "center" }}>{companies.length} companies loaded</span>}
      </div>

      {companies.length > 0 && (
        <div style={{ ...s.card, padding: "0", overflow: "hidden" }}>
          <table style={s.table}>
            <thead>
              <tr>{["#", "Company", "Contact", "Email", "Designation", ""].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {companies.map((c, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#08111b" }}>
                  <td style={{ ...s.td, color: "#4a5568", width: "40px" }}>{i + 1}</td>
                  {["company", "contact", "email", "designation"].map((k) => (
                    <td key={k} style={s.td}>
                      <input style={{ background: "transparent", border: "none", color: "#cbd5e1", fontSize: "12px", fontFamily: "inherit", outline: "none", width: "100%" }}
                        value={c[k]} onChange={(e) => setCompanies((prev) => { const n = [...prev]; n[i] = { ...n[i], [k]: e.target.value }; return n; })} />
                    </td>
                  ))}
                  <td style={s.td}>
                    <button style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: "14px" }}
                      onClick={() => setCompanies((p) => p.filter((_, j) => j !== i))}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: "24px", display: "flex", justifyContent: "space-between" }}>
        <button style={s.btnGhost} onClick={() => setStep(1)}>← Back</button>
        <button style={s.btnPrimary} onClick={() => {
          if (!companies.length) return showToast("Add at least one company!", "error");
          if (companies.some((c) => !c.email)) return showToast("All rows must have an email!", "error");
          setStep(3);
        }}>Next: Generate & Send →</button>
      </div>
    </div>
  );

  const renderSend = () => {
    const allGenerated = companies.length > 0 && Object.keys(emails).length === companies.length;
    const totalSent = Object.values(sendProgress).filter((x) => x === "sent").length;
    const totalFailed = Object.values(sendProgress).filter((x) => x === "failed").length;

    return (
      <div>
        <p style={s.sectionTitle}>{"// 04 — Generate & Send"}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
          {[["Total", companies.length, "#60a5fa"], ["Generated", Object.keys(emails).length, "#f0b429"], ["Sent", totalSent, "#34d399"], ["Failed", totalFailed, "#f87171"]].map(([label, val, color]) => (
            <div key={label} style={{ ...s.card, padding: "16px", textAlign: "center", marginBottom: 0, borderColor: color + "33" }}>
              <div style={{ fontSize: "28px", fontWeight: "700", color, marginBottom: "4px" }}>{val}</div>
              <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#4a5568" }}>{label}</div>
            </div>
          ))}
        </div>

        {!resumePdf && (
          <div style={{ background: "#1a0e00", border: "1px solid #78350f", borderRadius: "6px", padding: "12px 16px", marginBottom: "16px", fontSize: "12px", color: "#fcd34d", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>⚠</span><span>No resume PDF uploaded. Go back to <strong>Step 01 Profile</strong> and upload your resume.</span>
          </div>
        )}
        {resumePdf && (
          <div style={{ background: "#052e1c", border: "1px solid #34d39944", borderRadius: "6px", padding: "12px 16px", marginBottom: "16px", fontSize: "12px", color: "#34d399", display: "flex", alignItems: "center", gap: "10px" }}>
            <span>📄</span><span>Resume attached: <strong>{resumePdf.name}</strong> — will be sent with every email.</span>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", alignItems: "center" }}>
          <button style={{ ...s.btnPrimary, opacity: generating ? 0.6 : 1, cursor: generating ? "not-allowed" : "pointer" }}
            onClick={!generating ? generateEmails : undefined}>
            {generating ? `Generating... ${generateProgress}%` : allGenerated ? "↺ Regenerate All" : "⚡ Generate All Emails"}
          </button>

          {allGenerated && !sending && (
            <button style={{ ...s.btnGreen, padding: "12px 24px", fontSize: "11px", letterSpacing: "2px" }} onClick={sendAll}>
              🚀 Send All ({companies.filter((_, i) => emails[i]?.status !== "sent").length} pending)
            </button>
          )}

          {sending && <span style={{ fontSize: "12px", color: "#60a5fa" }}>Sending... {totalSent}/{companies.length}</span>}
        </div>

        {generating && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", color: "#f0b429", marginBottom: "6px", letterSpacing: "1px" }}>
              Generating email {Math.ceil((generateProgress / 100) * companies.length)} of {companies.length}...
            </div>
            <div style={s.progressBar}><div style={s.progressFill(generateProgress)} /></div>
          </div>
        )}

        <div style={s.card}>
          <table style={s.table}>
            <thead><tr>{["#", "Company", "Contact", "Email", "Status", "Actions"].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
            <tbody>
              {companies.map((c, i) => {
                const status = sendProgress[i] || (emails[i] ? "ready" : "pending");
                return (
                  <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "#08111b" }}>
                    <td style={{ ...s.td, color: "#4a5568" }}>{i + 1}</td>
                    <td style={s.td}>{c.company}</td>
                    <td style={{ ...s.td, color: "#7dd3fc" }}>{c.contact || "—"}</td>
                    <td style={{ ...s.td, color: "#94a3b8" }}>{c.email}</td>
                    <td style={s.td}><span style={s.badge(status)}>{statusLabels[status] || status}</span></td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {emails[i] && <button style={{ background: "transparent", border: "1px solid #1e2a3a", color: "#7dd3fc", borderRadius: "3px", padding: "4px 10px", fontSize: "10px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }} onClick={() => setActivePreview(i)}>Preview</button>}
                        {emails[i] && status !== "sent" && <button style={{ background: "transparent", border: "1px solid #f0b42966", color: "#f0b429", borderRadius: "3px", padding: "4px 10px", fontSize: "10px", cursor: "pointer", fontFamily: "inherit", letterSpacing: "1px" }} onClick={() => sendOne(i)}>Send</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "24px" }}><button style={s.btnGhost} onClick={() => setStep(2)}>← Back</button></div>
      </div>
    );
  };

  const renderModal = () => {
    if (activePreview === null) return null;
    const emailData = emails[activePreview];
    const company = companies[activePreview];
    if (!emailData) return null;

    return (
      <div style={s.modal} onClick={() => setActivePreview(null)}>
        <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <p style={{ margin: "0 0 4px 0", color: "#f0b429", fontSize: "11px", letterSpacing: "2px" }}>EMAIL PREVIEW</p>
              <p style={{ margin: 0, color: "#7dd3fc", fontSize: "13px" }}>→ {company.company} ({company.email})</p>
            </div>
            <button style={{ background: "transparent", border: "none", color: "#4a5568", fontSize: "20px", cursor: "pointer" }} onClick={() => setActivePreview(null)}>✕</button>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={s.label}>Subject</label>
            {editingEmail === activePreview ? (
              <input style={s.input} value={emailData.subject}
                onChange={(e) => setEmails((prev) => ({ ...prev, [activePreview]: { ...prev[activePreview], subject: e.target.value } }))} />
            ) : (
              <p style={{ margin: 0, color: "#e2e8f0", fontSize: "13px", padding: "10px 12px", background: "#0a0d13", borderRadius: "4px", border: "1px solid #1e2a3a" }}>{emailData.subject}</p>
            )}
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label style={s.label}>Body</label>
            {editingEmail === activePreview ? (
              <textarea style={{ ...s.textarea, minHeight: "240px" }} value={emailData.body}
                onChange={(e) => setEmails((prev) => ({ ...prev, [activePreview]: { ...prev[activePreview], body: e.target.value } }))} />
            ) : (
              <pre style={{ margin: 0, color: "#cbd5e1", fontSize: "12px", padding: "14px", background: "#0a0d13", borderRadius: "4px", border: "1px solid #1e2a3a", whiteSpace: "pre-wrap", lineHeight: "1.7" }}>{emailData.body}</pre>
            )}
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            {editingEmail === activePreview ? (
              <button style={s.btnPrimary} onClick={() => setEditingEmail(null)}>Save Changes</button>
            ) : (
              <button style={s.btnGhost} onClick={() => setEditingEmail(activePreview)}>Edit</button>
            )}
            {emails[activePreview]?.status !== "sent" && (
              <button style={s.btnGreen} onClick={() => { sendOne(activePreview); setActivePreview(null); }}>🚀 Send Now</button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={s.app}>
      <div style={s.header}>
        <div>
          <div style={s.logo}>MAIL BLAST</div>
          <div style={s.logoSub}>JOB APPLICATION AUTOMATION</div>
        </div>
        <div style={s.stepper}>
          {STEPS.map((label, i) => (
            <button key={i} style={s.stepBtn(i)} onClick={() => setStep(i)}>{`0${i + 1}. ${label}`}</button>
          ))}
        </div>
      </div>

      <div style={s.main}>
        {step === 0 && renderProfile()}
        {step === 1 && renderEmailSetup()}
        {step === 2 && renderCompanies()}
        {step === 3 && renderSend()}
      </div>

      {renderModal()}
      {toast && <div style={s.toast(toast.type)}>{toast.msg}</div>}
      <Analytics />
    </div>
  );
}
