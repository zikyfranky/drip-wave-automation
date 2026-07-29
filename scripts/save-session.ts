import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const COOKIES_PATH = path.resolve(__dirname, '../data/cookies.json');

async function save() {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto('https://app.drips.network/wave');
    console.log('Log in manually, then I will save the cookies...');
    await page.waitForSelector('button.logout-btn', { timeout: 0 }); // Wait for something that shows you are logged in
    const cookies = await page.cookies();
    fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
    await browser.close();
}
EOF && git add . && git commit -m 'Add Puppeteer Auto-Applier skeleton and Session saver' && git push origin main
