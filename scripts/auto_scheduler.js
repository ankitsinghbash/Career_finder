const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const https = require('https');

// Dual logging: writes to both console and scripts/daemon.log in real time
const logFile = path.join(__dirname, 'daemon.log');
const origLog = console.log;
const origErr = console.error;

console.log = function(...args) {
    origLog.apply(console, args);
    try {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        fs.appendFileSync(logFile, msg + '\n');
    } catch (e) {}
};

console.error = function(...args) {
    origErr.apply(console, args);
    try {
        const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
        fs.appendFileSync(logFile, '[ERROR] ' + msg + '\n');
    } catch (e) {}
};

process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
    console.error('CRITICAL UNHANDLED REJECTION:', reason && reason.stack ? reason.stack : reason);
});

const { scrapeNaukriLatestJobs, normalizeJobKey } = require('./naukri_scraper');

// 1. Load .env config
function loadEnv() {
    const envPath = path.join(__dirname, '..', '.env');
    const config = {
        TELEGRAM_BOT_TOKEN: '',
        TELEGRAM_CHAT_ID: '',
        POLL_INTERVAL_SECS: 1800, // Default 30 minutes
        MIN_MATCH_SCORE: 70,
        BATCH_SIZE: 25 // Send at least 25 jobs per cycle
    };

    if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [k, ...v] = trimmed.split('=');
                const key = k.trim();
                const val = v.join('=').trim();
                if (key === 'TELEGRAM_BOT_TOKEN') config.TELEGRAM_BOT_TOKEN = val;
                if (key === 'TELEGRAM_CHAT_ID') config.TELEGRAM_CHAT_ID = val;
                if (key === 'POLL_INTERVAL_SECS') config.POLL_INTERVAL_SECS = parseInt(val) || 1800;
                if (key === 'MIN_MATCH_SCORE') config.MIN_MATCH_SCORE = parseFloat(val) || 70;
                if (key === 'BATCH_SIZE') config.BATCH_SIZE = parseInt(val) || 25;
            }
        }
    }
    return config;
}

// 2. Telegram message sender helper
function sendTelegramMessage(botToken, chatId, htmlText) {
    return new Promise((resolve, reject) => {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        const payload = JSON.stringify({
            chat_id: chatId,
            text: htmlText,
            parse_mode: 'HTML',
            disable_web_page_preview: false
        });

        const req = https.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.ok) resolve(parsed);
                    else reject(new Error(parsed.description || 'Telegram API error'));
                } catch (e) {
                    reject(e);
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 3. Main automated crawl & alert loop
async function runAutomationCycle(config) {
    const now = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    console.log(`\n================================================================`);
    console.log(`🚀 [${now}] STARTING AUTOMATED JOB CRAWL CYCLE FOR ANKIT SINGH`);
    console.log(`================================================================`);

    // Step A: Trigger Chromium Stealth Scraper directly (in-process)
    console.log('🌐 Step 1: Running Chromium scraper for today\'s fresh jobs...');
    try {
        await scrapeNaukriLatestJobs();
    } catch (err) {
        console.error('❌ Error during Naukri scraping:', err.message);
    }

    // Step B: Query unnotified high-match jobs from SQLite
    const dbPath = path.join(__dirname, '..', 'jobs.db');
    if (!fs.existsSync(dbPath)) {
        console.log('⚠️ Database not found, skipping notifications.');
        return;
    }

    console.log('\n📬 Step 2: Checking SQLite for new qualified jobs to notify...');
    const db = new sqlite3.Database(dbPath);

    function isStrictlyAnkitStack(job) {
        const titleLower = (job.title || '').toLowerCase();
        const skillsLower = (job.matched_skills || '').toLowerCase();
        const combined = `${titleLower} ${skillsLower}`;

        // 1. Disqualify Java
        if (/\b(java|j2ee|spring|springboot|spring boot|hibernate)\b/i.test(titleLower)) return false;
        if (/\b(springboot|spring boot|hibernate|j2ee)\b/i.test(combined)) return false;
        if (/\bjava\b/i.test(skillsLower) && !/\b(node|nodejs|express)\b/i.test(skillsLower)) return false;

        // 2. Disqualify Python, Django, Flask, FastAPI
        if (/\b(python|django|flask|fastapi|pyspark)\b/i.test(titleLower)) return false;
        if (/\b(django|flask|fastapi|pyspark)\b/i.test(combined)) return false;
        if (/\bpython\b/i.test(skillsLower) && !/\b(node|nodejs|express)\b/i.test(skillsLower)) return false;

        // 3. Disqualify .NET, C#, PHP, Angular, Ruby, Golang
        if (/(\bnet\b|\.net|dotnet|\bc#\b|\bphp\b|\blaravel\b|\bwordpress\b|\bangular\b|\bruby\b|\brails\b|\bgolang\b|\bgo developer\b)/i.test(titleLower)) return false;

        // 4. Disqualify QA / Testers / Leads / Non-Junior/Mid roles
        if (/\b(tester|testing|qa|test lead|automation tester|manual tester|sdet)\b/i.test(titleLower)) return false;
        if (/\b(lead|tech lead|technical lead|team lead|principal|architect|manager|staff)\b/i.test(titleLower)) return false;

        // 5. Disqualify Non-Tech spam
        if (/\b(recruiter|hr|sales|telecaller|telesales|bpo|non voice|customer care|tour|travel|teacher|instructor)\b/i.test(titleLower)) return false;

        // 6. MUST strictly contain Ankit's tech stack (Node, React, Next, TypeScript, JavaScript, MongoDB, PostgreSQL, Redis, Full Stack)
        const hasAnkitStack = /\b(node|nodejs|node\.js|react|reactjs|react\.js|next|nextjs|next\.js|typescript|javascript|mern|express|mongodb|postgres|postgresql|redis|full stack|fullstack|frontend|backend)\b/i.test(combined);
        return hasAnkitStack;
    }

function formatTimeAgo(dateStr) {
    if (!dateStr) return 'Recently';
    const ms = Date.now() - new Date(dateStr).getTime();
    if (isNaN(ms)) return 'Recently';
    const mins = Math.floor(ms / (1000 * 60));
    if (mins < 1) return 'Just now (Today)';
    if (mins < 60) return `${mins}m ago (Today)`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago (Today)`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
}

    // Query jobs that haven't been notified yet (ordered strictly by latest posted_date first)
    const rawPending = await new Promise((resolve) => {
        db.all(
            `SELECT * FROM jobs 
             WHERE match_score >= ? 
               AND notified_at IS NULL 
               AND (posted_date >= datetime('now', '-2 days') OR posted_date IS NULL)
             ORDER BY posted_date DESC, match_score DESC, id DESC 
             LIMIT ?`,
            [config.MIN_MATCH_SCORE, config.BATCH_SIZE * 5],
            (err, rows) => {
                if (err) {
                    console.error('Database query error:', err);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            }
        );
    });

    const pendingJobs = [];
    const sessionKeys = new Set();
    let duplicatesSkipped = 0;

    for (const job of rawPending) {
        if (!isStrictlyAnkitStack(job)) {
            // Disqualify non-stack job in db so it never gets queued again
            db.run(`UPDATE jobs SET match_score = 0, notified_at = datetime('now') WHERE id = ?`, [job.id]);
            continue;
        }

        // Strict 48hr filter: Verify true posting date from Naukri ID (DDMMYY)
        const idMatch = (job.external_job_id || '').match(/NAUKRI-(\d{6})/) || (job.job_url || '').match(/-(\d{6})\d+/);
        if (idMatch && idMatch[1]) {
            const ddmmyy = idMatch[1];
            const day = parseInt(ddmmyy.slice(0, 2), 10);
            const month = parseInt(ddmmyy.slice(2, 4), 10);
            const year = 2000 + parseInt(ddmmyy.slice(4, 6), 10);
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                const postDate = new Date(year, month - 1, day);
                const ageDays = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
                if (ageDays > 2.2) {
                    // Discard bumped job from August/early September
                    db.run(`UPDATE jobs SET match_score = 0, notified_at = datetime('now') WHERE id = ?`, [job.id]);
                    continue;
                }
                job.posted_date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        } else if (job.posted_date) {
            const ageHours = (Date.now() - new Date(job.posted_date).getTime()) / (1000 * 60 * 60);
            if (ageHours > 48) {
                db.run(`UPDATE jobs SET match_score = 0, notified_at = datetime('now') WHERE id = ?`, [job.id]);
                continue;
            }
        }

        const dedupKey = normalizeJobKey(job.company, job.title);
        if (sessionKeys.has(dedupKey)) {
            // Skip sending identical company+title in the same batch
            duplicatesSkipped++;
            continue;
        }

        // Unique job confirmed!
        sessionKeys.add(dedupKey);
        pendingJobs.push(job);
        if (pendingJobs.length >= config.BATCH_SIZE) break;
    }

    if (duplicatesSkipped > 0) {
        console.log(`🛡️ Deduplication Guard: Filtered out ${duplicatesSkipped} duplicate company/role listings in this batch.`);
    }

    if (pendingJobs.length === 0) {
        console.log('✨ No new unnotified matches in this cycle. All caught up!');
    } else {
        console.log(`🎯 Found ${pendingJobs.length} new high-match jobs (100% Node/React/Next/TS)! Dispatching to Telegram (Target: ${config.BATCH_SIZE})...`);

        // Send header digest
        const digestHeader = `🚀 <b>Career Crawler Alert (Ankit Singh)</b>\n\n🎯 <i>Found ${pendingJobs.length} fresh Node.js / React / Next.js / TypeScript matches posted today!</i>`;
        try {
            await sendTelegramMessage(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID, digestHeader);
        } catch (e) {
            console.error('Failed to send digest header:', e.message);
        }

        // Send each job alert
        for (const job of pendingJobs) {
            const card = 
                `🔔 <b>New Job Match [Score: ${Math.round(job.match_score)}%]</b>\n` +
                `🏢 <b>Company:</b> ${escapeHtml(job.company)}\n` +
                `💼 <b>Role:</b> ${escapeHtml(job.title)}\n` +
                `⏰ <b>Posted:</b> ${formatTimeAgo(job.posted_date)}\n` +
                `📍 <b>Location:</b> ${escapeHtml(job.location || 'India / Remote')}\n` +
                `⏳ <b>Exp:</b> ${escapeHtml(job.experience_level || '1-3 Years')}\n` +
                `🛠️ <b>Matched Skills:</b> ${escapeHtml(job.matched_skills || 'Full Stack, React, Node.js')}\n` +
                `🔗 <a href="${job.job_url}"><b>[Apply Now On Naukri]</b></a>`;

            try {
                await sendTelegramMessage(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID, card);
                console.log(`   ✅ Alert sent: [${job.match_score}%] ${job.company} - ${job.title} (${formatTimeAgo(job.posted_date)})`);

                // Mark notified in database
                await new Promise((res) => {
                    db.run(`UPDATE jobs SET notified_at = datetime('now') WHERE id = ?`, [job.id], res);
                });

                // Polite delay (350ms between messages)
                await new Promise(r => setTimeout(r, 350));
            } catch (err) {
                console.error(`   ❌ Failed to send Telegram alert for ${job.title}:`, err.message);
            }
        }
    }

    db.close();
}

// 4. Daemon runner
async function startDaemon() {
    const config = loadEnv();
    console.log('================================================================');
    console.log('🤖 ANKIT SINGH - AUTOMATED TELEGRAM CAREER CRAWLER DAEMON');
    console.log('================================================================');
    console.log(`⏱️  Configured Interval: Every ${config.POLL_INTERVAL_SECS} seconds (~${Math.round(config.POLL_INTERVAL_SECS / 60)} minutes)`);
    console.log(`📱 Telegram Chat ID:    ${config.TELEGRAM_CHAT_ID}`);
    console.log(`🎯 Min Match Threshold: ${config.MIN_MATCH_SCORE}%`);
    console.log('================================================================\n');

    while (true) {
        try {
            await runAutomationCycle(config);
        } catch (err) {
            console.error('Cycle execution error:', err);
        }

        const nextRunTimestamp = Date.now() + (config.POLL_INTERVAL_SECS * 1000);
        const nextTimeStr = new Date(nextRunTimestamp).toLocaleTimeString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        console.log(`\n⏳ Next automatic scan scheduled at: ${nextTimeStr} IST (~${Math.round(config.POLL_INTERVAL_SECS / 60)} minutes). Daemon is active...\n`);

        // Sleep in 5-second increments to handle laptop sleep/standby instantly upon wake
        while (Date.now() < nextRunTimestamp) {
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

startDaemon().catch(console.error);
