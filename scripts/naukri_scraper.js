const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Search targets strictly tailored to Ankit Singh (Full Stack: React, Next.js, Node.js, TypeScript, 1-3 Yrs | Last 24 Hours)
const SEARCH_TARGETS = [
    { name: 'Full Stack Developer (1-3 Yrs)', url: 'https://www.naukri.com/full-stack-developer-jobs?experience=2&postDays=1&sort=f' },
    { name: 'Next.js & React.js Developer (1-3 Yrs)', url: 'https://www.naukri.com/react-next-js-developer-jobs?experience=2&postDays=1&sort=f' },
    { name: 'Node.js Developer (1-3 Yrs)', url: 'https://www.naukri.com/node-js-developer-jobs?experience=2&postDays=1&sort=f' },
    { name: 'React.js Developer (1-3 Yrs)', url: 'https://www.naukri.com/react-js-developer-jobs?experience=2&postDays=1&sort=f' },
    { name: 'Backend Developer (Node.js | 1-3 Yrs)', url: 'https://www.naukri.com/backend-developer-node-js-jobs?experience=2&postDays=1&sort=f' },
    { name: 'SDE-1 / Software Engineer (1-3 Yrs)', url: 'https://www.naukri.com/sde-1-jobs?experience=2&postDays=1&sort=f' },
    { name: 'MERN Stack Developer (1-3 Yrs)', url: 'https://www.naukri.com/mern-stack-developer-jobs?experience=2&postDays=1&sort=f' },
    { name: 'TypeScript Developer (1-3 Yrs)', url: 'https://www.naukri.com/typescript-developer-jobs?experience=2&postDays=1&sort=f' },
    { name: 'Full Stack Engineer (1-3 Yrs)', url: 'https://www.naukri.com/full-stack-engineer-jobs?experience=2&postDays=1&sort=f' },
];

// Helper to extract DOM job cards from current page
async function extractDomCards(page, allJobs) {
    try {
        const domJobs = await page.evaluate(() => {
            const results = [];
            const cards = document.querySelectorAll('.srp-jobtuple-wrapper, article.jobTuple, [data-job-id], .cust-job-tuple');
            cards.forEach(card => {
                const titleEl = card.querySelector('a.title, a[class*="title"]');
                const compEl = card.querySelector('a.comp-name, a[class*="comp-name"], .companyName');
                const expEl = card.querySelector('.exp-wrap, [class*="exp"], .experience');
                const locEl = card.querySelector('.loc-wrap, [class*="loc"], .location');
                const descEl = card.querySelector('.job-desc, [class*="job-desc"], .jobDescription');
                const tags = Array.from(card.querySelectorAll('.tags-gt li, ul.tags li, [class*="tag"]')).map(t => t.innerText.trim());

                if (titleEl && titleEl.href) {
                    results.push({
                        title: titleEl.innerText.trim(),
                        company: compEl ? compEl.innerText.trim() : 'Confidential',
                        url: titleEl.href,
                        experience: expEl ? expEl.innerText.trim() : '0-2 Yrs',
                        location: locEl ? locEl.innerText.trim() : 'India',
                        description: (descEl ? descEl.innerText.trim() : '') + (tags.length ? ` Skills: ${tags.join(', ')}` : ''),
                        skills: tags.join(', ')
                    });
                }
            });
            return results;
        });

        for (const dj of domJobs) {
            if (!allJobs.has(dj.url)) {
                allJobs.set(dj.url, {
                    external_id: `NAUKRI-DOM-${Math.abs(dj.url.split('').reduce((a,b)=>{a=((a<<5)-a)+b.charCodeAt(0);return a&a},0))}`,
                    title: dj.title,
                    company: dj.company,
                    url: dj.url,
                    experience: dj.experience,
                    salary: 'Not disclosed',
                    location: dj.location,
                    skills: dj.skills,
                    description: dj.description,
                    created_date: new Date().toISOString(),
                    source: 'Naukri DOM'
                });
            }
        }
    } catch (e) {}
}

// Normalize company and title for bulletproof deduplication
function normalizeJobKey(company, title) {
    const cleanCompany = (company || '')
        .toLowerCase()
        .replace(/\b(pvt|ltd|limited|private|llp|inc|technologies|technology|consultants|consulting|services|solutions)\b/gi, '')
        .replace(/[^a-z0-9]/g, '');

    const cleanTitle = (title || '')
        .toLowerCase()
        .replace(/\(.*?\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\b(inf|sde-?1|sde-?i|immediate joiner|urgent hiring)\b/gi, '')
        .replace(/[^a-z0-9]/g, '');

    return `${cleanCompany}:::${cleanTitle}`;
}

async function scrapeNaukriLatestJobs() {
    console.log('================================================================');
    console.log('⚡ NAUKRI CHROMIUM + REST API CRAWLER (TODAY LATEST JOBS)');
    console.log('================================================================');

    // 1. Launch Chromium with Stealth configuration (Cross-platform: Windows / Linux / GCP)
    console.log('🌐 Launching Chromium browser with Stealth bypass...');
    const launchOptions = {
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-infobars',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    };

    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        launchOptions.executablePath = process.env.CHROME_PATH;
    } else if (process.platform === 'win32' && fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
        launchOptions.executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    }

    const browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US,en;q=0.9',
        extraHTTPHeaders: {
            'accept-language': 'en-US,en;q=0.9',
            'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        }
    });

    const page = await context.newPage();

    // Stealth evasion injection
    await page.addInitScript(() => {
        delete Object.getPrototypeOf(navigator).webdriver;
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };
    });

    const allJobs = new Map();

    // 2. Intercept internal REST API responses
    page.on('response', async response => {
        const url = response.url();
        if (url.includes('jobapi/v3/search')) {
            try {
                const json = await response.json();
                if (json.jobDetails && Array.isArray(json.jobDetails)) {
                    console.log(`   [REST API Intercepted] ${json.jobDetails.length} jobs captured from API.`);
                    for (const item of json.jobDetails) {
                        const jobId = item.jobId || String(Date.now() + Math.random());
                        let fullUrl = item.staticUrl
                            ? (item.staticUrl.startsWith('http') ? item.staticUrl : `https://www.naukri.com/${item.staticUrl}`)
                            : `https://www.naukri.com/job-listings-${jobId}`;

                        let exp = 'Not specified';
                        let salary = 'Not disclosed';
                        let loc = 'India';

                        if (item.placeholders) {
                            for (const p of item.placeholders) {
                                if (p.type === 'experience') exp = p.label || exp;
                                if (p.type === 'salary') salary = p.label || salary;
                                if (p.type === 'location') loc = p.label || loc;
                            }
                        }

                        allJobs.set(fullUrl, {
                            external_id: `NAUKRI-${jobId}`,
                            title: item.title || 'Untitled Role',
                            company: item.companyName || 'Confidential Company',
                            url: fullUrl,
                            experience: exp,
                            salary: salary,
                            location: loc,
                            skills: item.tagsAndSkills || '',
                            description: (item.jobDescription || '') + (item.tagsAndSkills ? ` | Skills: ${item.tagsAndSkills}` : ''),
                            created_date: item.createdDate ? new Date(Number(item.createdDate)).toISOString() : new Date().toISOString(),
                            source: 'Naukri REST API'
                        });
                    }
                }
            } catch (err) {
                // Ignore parsing errors for non-JSON or fragmented streams
            }
        }
    });

    // 3. Warmup session: Visit homepage to acquire fresh Akamai session cookies
    console.log('🍪 Warming up session & acquiring security cookies from homepage...');
    try {
        await page.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: 25000 });
        await page.waitForTimeout(2500);
    } catch (e) {
        console.warn('   ⚠️ Homepage warmup warning:', e.message);
    }

    // 4. Iterate through target categories with multi-page pagination
    for (const target of SEARCH_TARGETS) {
        console.log(`\n🔍 Scraping Target: ${target.name}`);
        console.log(`   URL: ${target.url}`);
        try {
            const initialCount = allJobs.size;

            // Page 1
            await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(3000);
            await extractDomCards(page, allJobs);

            // Page 2
            try {
                const p2 = await page.$('a[href*="-jobs-2"]');
                if (p2) {
                    await p2.click();
                    await page.waitForTimeout(3000);
                    await extractDomCards(page, allJobs);
                }
            } catch (e) {}

            // Page 3
            try {
                const p3 = await page.$('a[href*="-jobs-3"]');
                if (p3) {
                    await p3.click();
                    await page.waitForTimeout(3000);
                    await extractDomCards(page, allJobs);
                }
            } catch (e) {}

            const gained = allJobs.size - initialCount;
            console.log(`   ✅ Acquired ${gained} new unique jobs from this category.`);
        } catch (err) {
            console.error(`   ❌ Failed to scrape ${target.name}: ${err.message}`);
        }
    }

    await browser.close();

    const jobsArray = Array.from(allJobs.values());
    console.log(`\n================================================================`);
    console.log(`🎉 SCRAPING COMPLETE: Total ${jobsArray.length} Unique Latest Jobs Scraped!`);
    console.log(`================================================================`);

    // Ankit Singh Resume-Specific Evaluator (2.1 Yrs, Full Stack Next/React/Node/TS)
    function evaluateJobForAnkit(job) {
        // 0. Bulletproof True Posting Date Check from Naukri Job ID (DDMMYY)
        const idMatch = (job.external_id || '').match(/NAUKRI-(\d{6})/) || (job.url || '').match(/-(\d{6})\d+/);
        if (idMatch && idMatch[1]) {
            const ddmmyy = idMatch[1];
            const day = parseInt(ddmmyy.slice(0, 2), 10);
            const month = parseInt(ddmmyy.slice(2, 4), 10);
            const year = 2000 + parseInt(ddmmyy.slice(4, 6), 10);
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                const postDate = new Date(year, month - 1, day);
                const ageDays = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
                if (ageDays > 2.2) { // Reject any job older than 48 hours!
                    return { isMatch: false, score: 0 };
                }
                job.posted_date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
        }

        const text = `${job.title} ${job.description} ${job.skills}`.toLowerCase();
        const titleLower = job.title.toLowerCase();

        // 1. Hard Disqualifiers (Non-tech / unrelated / spam)
        const negativeKeywords = [
            'recruiter', 'hr ', 'hr recruiter', 'sales', 'telesales', 'telecaller', 'telecalling',
            'bpo', 'non voice', 'customer service', 'customer support', 'back office',
            'chat process', 'voice process', 'tour', 'travel', 'ticketing', 'driver',
            'nurse', 'pharmacist', 'content writer', 'accountant', 'telecom network', 'voip'
        ];
        for (const neg of negativeKeywords) {
            if (titleLower.includes(neg)) {
                return { isMatch: false, score: 0 };
            }
        }

        // 2. Strict Language Disqualifiers (Java, Python, .NET, PHP, Angular - NOT Ankit's stack)
        // Must reject if Java or Python or .NET or PHP or Angular or QA in title:
        if (/\b(java|j2ee|spring|springboot|spring boot|hibernate)\b/i.test(titleLower)) {
            return { isMatch: false, score: 0 };
        }
        if (/\b(python|django|flask|fastapi|pyspark)\b/i.test(titleLower)) {
            return { isMatch: false, score: 0 };
        }
        if (/(\bangular\b|\.net\b|dotnet|\bc#\b|\bphp\b|\blaravel\b|\bwordpress\b|\bruby\b|\brails\b|\bgolang\b|\bgo developer\b)/i.test(titleLower)) {
            return { isMatch: false, score: 0 };
        }
        if (/\b(tester|testing|qa|test lead|automation tester|manual tester|sdet)\b/i.test(titleLower)) {
            return { isMatch: false, score: 0 };
        }

        // Reject if Java/Python backend frameworks appear anywhere in description or skills:
        if (/\b(springboot|spring boot|hibernate|j2ee|django|flask|fastapi|pyspark|laravel|wordpress)\b/i.test(text)) {
            return { isMatch: false, score: 0 };
        }

        // If skills contain Java or Python without Node.js/Express, reject:
        if (/\bjava\b/i.test(job.skills || '') && !/\b(node|nodejs|express)\b/i.test(job.skills || '')) {
            return { isMatch: false, score: 0 };
        }
        if (/\bpython\b/i.test(job.skills || '') && !/\b(node|nodejs|express)\b/i.test(job.skills || '')) {
            return { isMatch: false, score: 0 };
        }

        // 3. Mandatory Positive Tech Stack Check: MUST have at least one of Ankit's core skills!
        const hasCoreStack = /\b(node|nodejs|node\.js|react|reactjs|react\.js|next|nextjs|next\.js|typescript|javascript|mern|express|mongodb|postgres|postgresql|redis)\b/i.test(text);
        if (!hasCoreStack) {
            return { isMatch: false, score: 0 };
        }

        // 4. Title Relevance (Max 30)
        let titleScore = 0;
        const targetRoles = [
            'full stack', 'fullstack', 'backend', 'frontend', 'node', 'react', 'next.js',
            'nextjs', 'typescript', 'sde', 'software engineer', 'software developer', 'mern'
        ];
        for (const role of targetRoles) {
            if (titleLower.includes(role)) {
                titleScore = 30;
                break;
            }
        }
        if (titleScore === 0) {
            if (titleLower.includes('developer') || titleLower.includes('engineer')) {
                titleScore = 15;
            }
        }

        // 5. Experience Match (Max 25) - Target: 1-3 Yrs
        let expScore = 15;
        if (job.experience) {
            const expMatch = job.experience.match(/(\d+)\s*(?:-|to)\s*(\d+)/i);
            if (expMatch) {
                const minExp = parseInt(expMatch[1]);
                const maxExp = parseInt(expMatch[2]);
                if (minExp <= 2 && maxExp >= 2) {
                    expScore = 25; // Perfect 1-3, 2-4 yr bracket
                } else if (maxExp <= 4) {
                    expScore = 20;
                } else if (minExp >= 6) {
                    expScore = 5; // Too senior
                }
            }
        }

        // 6. Skills Match (Max 45)
        let skillScore = 0;
        const matched = [];
        const skillWeights = {
            'next.js': 8, 'nextjs': 8, 'react': 8, 'node.js': 8, 'nodejs': 8, 'node': 6,
            'typescript': 7, 'javascript': 5, 'mongodb': 6, 'postgres': 6, 'postgresql': 6,
            'redis': 6, 'rabbitmq': 5, 'socket.io': 5, 'websocket': 4, 'docker': 5, 'aws': 5,
            'microservices': 6, 'system design': 5, 'express': 5, 'tailwind': 4, 'redux': 4
        };

        for (const [skill, weight] of Object.entries(skillWeights)) {
            if (text.includes(skill)) {
                skillScore += weight;
                matched.push(skill);
            }
        }
        skillScore = Math.min(skillScore, 45);

        const totalScore = titleScore + expScore + skillScore;
        const isMatch = totalScore >= 60 && titleScore > 0;

        return {
            isMatch,
            score: Math.min(Math.round(totalScore), 100),
            matchedSkills: Array.from(new Set(matched))
        };
    }

    // Filter and score jobs specifically for Ankit Singh (with strict deduplication)
    const qualifiedJobs = [];
    const seenMap = new Map();

    for (const job of jobsArray) {
        const evalRes = evaluateJobForAnkit(job);
        if (evalRes.isMatch) {
            job.match_score = evalRes.score;
            job.matched_skills = evalRes.matchedSkills.join(', ');

            const key = normalizeJobKey(job.company, job.title);
            if (seenMap.has(key)) {
                // Merge multiple locations if unique (e.g. Remote, Noida, Mumbai)
                const existing = seenMap.get(key);
                if (job.location && !existing.location.toLowerCase().includes(job.location.toLowerCase())) {
                    existing.location = `${existing.location}, ${job.location}`.substring(0, 120);
                }
                // Keep the higher match score if differing
                if (job.match_score > existing.match_score) {
                    existing.match_score = job.match_score;
                }
            } else {
                seenMap.set(key, job);
                qualifiedJobs.push(job);
            }
        }
    }

    // Sort by match score descending
    qualifiedJobs.sort((a, b) => b.match_score - a.match_score);

    console.log(`\n🎯 Resume Match Filtering: Kept ${qualifiedJobs.length} unique top-matched jobs (Filtered out ${jobsArray.length - qualifiedJobs.length} duplicate/noise cards)`);

    // 4. Save to JSON file
    const jsonPath = path.join(__dirname, 'naukri_scraped.json');
    fs.writeFileSync(jsonPath, JSON.stringify(qualifiedJobs, null, 2));
    console.log(`💾 Saved qualified jobs to: ${jsonPath}`);

    // 5. Ingest into SQLite jobs.db with Real Calculated Score
    const dbPath = path.join(__dirname, '..', 'jobs.db');
    if (fs.existsSync(dbPath)) {
        console.log(`\n🔄 Ingesting into SQLite database: ${dbPath}`);
        await new Promise((resolve) => {
            const db = new sqlite3.Database(dbPath);
            let inserted = 0;
            let duplicates = 0;

            db.serialize(() => {
                const stmt = db.prepare(`
                    INSERT INTO jobs 
                    (company, title, external_job_id, job_url, location, experience_level, match_score, matched_skills, posted_date, discovered_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                    ON CONFLICT(company, external_job_id) DO UPDATE SET
                        match_score = excluded.match_score,
                        matched_skills = excluded.matched_skills,
                        posted_date = excluded.posted_date
                `);

                for (const job of qualifiedJobs) {
                    stmt.run(
                        job.company,
                        job.title,
                        job.external_id,
                        job.url,
                        job.location,
                        job.experience,
                        job.match_score,
                        job.matched_skills || 'Full Stack, Node.js, React',
                        job.created_date || new Date().toISOString(),
                        function(err) {
                            if (err) {
                                // ignore
                            } else if (this.changes > 0) {
                                inserted++;
                            } else {
                                duplicates++;
                            }
                        }
                    );
                }

                stmt.finalize(() => {
                    db.close((err) => {
                        console.log(`📊 Database Sync: ${inserted} qualified jobs synced to database.`);
                        resolve();
                    });
                });
            });
        });
    }

    // 6. Print top matched sample jobs
    console.log(`\n🌟 Top Matched Jobs for Ankit Singh (Full Stack: React/Next/Node/TS | 2.1 Yrs):`);
    qualifiedJobs.slice(0, 5).forEach((j, i) => {
        console.log(`\n[${i+1}] [${j.match_score}% MATCH] ${j.company} - ${j.title}`);
        console.log(`    📍 Loc: ${j.location} | ⏳ Exp: ${j.experience} | 💰 Salary: ${j.salary}`);
        console.log(`    🔗 Link: ${j.url}`);
        if (j.matched_skills) console.log(`    🏷️ Matched Skills: ${j.matched_skills}`);
    });
}

module.exports = { scrapeNaukriLatestJobs, normalizeJobKey };

if (require.main === module) {
    scrapeNaukriLatestJobs().catch(e => {
        console.error('Fatal Scraper Error:', e);
        process.exit(1);
    });
}
