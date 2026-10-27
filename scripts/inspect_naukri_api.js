const { chromium } = require('playwright');

(async () => {
    const launchOptions = {
        headless: true,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-infobars',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    };
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
        launchOptions.executablePath = process.env.CHROME_PATH;
    } else if (process.platform === 'win32' && require('fs').existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
        launchOptions.executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    }
    const browser = await chromium.launch(launchOptions);
    const page = await browser.newPage();
    await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
    
    page.on('response', async res => {
        if (res.url().includes('jobapi/v3/search')) {
            try {
                const data = await res.json();
                console.log('Total jobs:', data.noOfJobs);
                if (data.jobDetails) {
                    data.jobDetails.slice(0, 15).forEach((j, i) => {
                        console.log(`\n--- JOB [${i+1}] ---`);
                        console.log('Title:', j.title);
                        console.log('Company:', j.companyName);
                        console.log('createdDate (raw timestamp):', j.createdDate);
                        console.log('createdDate formatted:', new Date(Number(j.createdDate)).toISOString());
                        console.log('footerPlaceholderLabel:', j.footerPlaceholderLabel);
                        console.log('placeholders:', JSON.stringify(j.placeholders));
                        console.log('tags:', j.tagsAndSkills);
                        console.log('URL:', j.staticUrl);
                    });
                }
            } catch (e) {
                console.error(e);
            }
        }
    });

    await page.goto('https://www.naukri.com/full-stack-developer-jobs?experience=2&postDays=1&sort=f', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await browser.close();
})();
