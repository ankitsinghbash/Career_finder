const { chromium } = require('playwright');

(async () => {
    console.log('Testing Naukri homepage warmup & extra stealth...');
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-infobars',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ]
    });

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
    await page.addInitScript(() => {
        delete Object.getPrototypeOf(navigator).webdriver;
        window.chrome = { runtime: {} };
    });

    page.on('response', async res => {
        const u = res.url();
        if (u.includes('jobapi/v3/search')) {
            console.log('🎉 [REST API Intercepted successfully!]', u.slice(0, 80));
        }
    });

    console.log('1. Visiting Homepage first...');
    const r1 = await page.goto('https://www.naukri.com/', { waitUntil: 'domcontentloaded', timeout: 25000 });
    console.log('Homepage status:', r1.status(), 'Title:', await page.title());

    await page.waitForTimeout(3000);

    console.log('2. Visiting Search page...');
    const r2 = await page.goto('https://www.naukri.com/full-stack-developer-jobs?experience=2&postDays=1&sort=f', {
        waitUntil: 'domcontentloaded',
        timeout: 25000
    });
    console.log('Search status:', r2.status(), 'Title:', await page.title());

    await page.waitForTimeout(4000);
    const cardCount = await page.$$eval('.srp-jobtuple-wrapper, article.jobTuple, [data-job-id], .cust-job-tuple', el => el.length);
    console.log('DOM Card Count:', cardCount);

    await browser.close();
})();
