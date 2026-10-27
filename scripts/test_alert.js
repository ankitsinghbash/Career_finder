const https = require("https");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const envPath = path.join(__dirname, "..", ".env");
const config = { TELEGRAM_BOT_TOKEN: "", TELEGRAM_CHAT_ID: "", MIN_MATCH_SCORE: 70 };
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
        const t = line.trim();
        if (!t || t.startsWith("#") || !t.includes("=")) return;
        const [k, ...v] = t.split("=");
        const key = k.trim(), val = v.join("=").trim();
        if (key === "TELEGRAM_BOT_TOKEN") config.TELEGRAM_BOT_TOKEN = val;
        if (key === "TELEGRAM_CHAT_ID") config.TELEGRAM_CHAT_ID = val;
        if (key === "MIN_MATCH_SCORE") config.MIN_MATCH_SCORE = parseFloat(val) || 70;
    });
}

function escapeHtml(t) { return (t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

function sendTelegram(text) {
    return new Promise((resolve, reject) => {
        const payload = JSON.stringify({ chat_id: config.TELEGRAM_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: false });
        const req = https.request({
            hostname: "api.telegram.org",
            path: "/bot" + config.TELEGRAM_BOT_TOKEN + "/sendMessage",
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) }
        }, (res) => {
            let d = "";
            res.on("data", c => d += c);
            res.on("end", () => { try { const r = JSON.parse(d); if (r.ok) resolve(r); else reject(new Error(r.description)); } catch(e){ reject(e); } });
        });
        req.on("error", reject);
        req.write(payload); req.end();
    });
}

async function main() {
    const db = new sqlite3.Database(path.join(__dirname, "..", "jobs.db"));

    await new Promise((res) => {
        db.run("UPDATE jobs SET notified_at = NULL WHERE match_score >= 75 AND date(notified_at) = date('now')", function(err) {
            console.log("Reset " + (this.changes||0) + " jobs for resend.");
            res();
        });
    });

    const jobs = await new Promise((res) => {
        db.all("SELECT * FROM jobs WHERE match_score >= ? AND notified_at IS NULL ORDER BY match_score DESC LIMIT 5", [config.MIN_MATCH_SCORE], (err, rows) => res(rows||[]));
    });

    if (!jobs.length) { console.log("No unnotified jobs found!"); db.close(); return; }
    console.log("Sending " + jobs.length + " alerts...");

    try { await sendTelegram("=9f680=9f680 <b>Career Crawler Test (Ankit Singh)</b>\n\nFound " + jobs.length + " top matches!"); console.log("Header sent."); } catch(e){ console.error("Header failed:", e.message); }

    for (const job of jobs) {
        const msg = "=9f514 <b>New Job Match [Score: " + Math.round(job.match_score) + "%]</b>\n=9f3e2 <b>Company:</b> " + escapeHtml(job.company) + "\n=9f4bc <b>Role:</b> " + escapeHtml(job.title) + "\n=9f4cd <b>Location:</b> " + escapeHtml(job.location||"India") + "\n=9f517 <b>Exp:</b> " + escapeHtml(job.experience_level||"1-3 Yrs") + "\n=9f6a7 <b>Skills:</b> " + escapeHtml(job.matched_skills||"") + "\n=9f517 <a href=\"" + job.job_url + "\"><b>[Apply Now on Naukri]</b></a>";
        try {
            await sendTelegram(msg);
            db.run("UPDATE jobs SET notified_at = datetime('now') WHERE id = ?", [job.id]);
            console.log("Sent: [" + job.match_score + "%] " + job.company + " - " + job.title);
        } catch(e) { console.error("Failed:", e.message); }
        await new Promise(r => setTimeout(r, 500));
    }
    db.close();
    console.log("Done! Check Telegram.");
}
main().catch(console.error);
