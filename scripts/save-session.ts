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
    await page.goto('https://app.drips.network/wave', { waitUntil: 'networkidle2' });
    
    console.log('Please log in manually in the browser window.');
    console.log('Once you are logged in and see the dashboard, come back here.');
    
    // Wait for the user to login - we look for the Logout text or profile indicator
    try {
        await page.waitForFunction(
            () => document.body.innerText.includes('Logout') || document.body.innerText.includes('Connected'),
            { timeout: 0 }
        );
        
        console.log('Login detected! Saving session...');
        const cookies = await page.cookies();
        
        const dir = path.dirname(COOKIES_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(COOKIES_PATH, JSON.stringify(cookies, null, 2));
        console.log(`Done! Session saved to: ${COOKIES_PATH}`);
        console.log('You can now upload this file to your server.');
    } catch (err) {
        console.error('Error during session save:', err);
    } finally {
        await browser.close();
        process.exit(0);
    }
}

save();
