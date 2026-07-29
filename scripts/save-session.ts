import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const COOKIES_PATH = path.resolve(__dirname, '../data/cookies.json');

async function save() {
    console.log('Starting browser...');
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    await page.goto('https://www.drips.network/wave/login', { waitUntil: 'networkidle2' });
    
    console.log('--- SESSION SAVER ---');
    console.log('1. Log in manually in the browser window.');
    console.log('2. Once finished, COME BACK TO THIS TERMINAL and press ENTER.');
    console.log('---------------------');

    // Use readline to wait for manual trigger since SPA states are tricky
    const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
    });

    readline.question('Press ENTER here after you have logged in and are on the dashboard...', async () => {
        console.log('Capturing cookies...');
        const cookies = await page.cookies();
        
        const dir = path.dirname(COOKIES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        console.log(`Done! Session saved to: ${COOKIES_PATH}`);
        
        readline.close();
        await browser.close();
        process.exit(0);
    });
}

save();
