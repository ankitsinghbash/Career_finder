const { loadEnv, runAutomationCycle } = require('./auto_scheduler');

async function main() {
    console.log('?? Running Career Finder Single Scrape Cycle...');
    const config = loadEnv();
    if (!config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
        console.error('? ERROR: Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in environment!');
        process.exit(1);
    }
    await runAutomationCycle(config);
    console.log('? Cycle finished successfully!');
    process.exit(0);
}

main().catch(err => {
    console.error('Fatal error during scrape cycle:', err);
    process.exit(1);
});
