import puppeteer from 'puppeteer';
import { query, run } from './database';
import path from 'path';

const COOKIES_PATH = path.resolve(__dirname, '../data/cookies.json');

export async function applyForIssue(issueId: string, pitch: string) {
    console.log(`Attempting automated application for issue ${issueId}...`);
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();
        
        // Load saved cookies for session persistence
        try {
            const fs = require('fs');
            if (fs.existsSync(COOKIES_PATH)) {
                const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
                await page.setCookie(...cookies);
            }
        } catch (e) {
            console.error('No cookies found, manual login required first.');
            return false;
        }

        const url = `https://app.drips.network/wave/stellar/issue/${issueId}`;
        await page.goto(url, { waitUntil: 'networkidle2' });

        // Check if we are logged in (look for Apply button or Logout)
        const applyButtonSelector = 'button:contains("Apply")'; 
        // Note: Actual selector needs to be verified against the live DOM
        
        const isLoggedIn = await page.evaluate(() => {
            return document.body.innerText.includes('Logout') || document.body.innerText.includes('Profile');
        });

        if (!isLoggedIn) {
            console.error('Session expired. Please run the login-session script.');
            return false;
        }

        // 1. Click Apply
        // 2. Wait for Modal
        // 3. Paste Pitch
        // 4. Submit
        
        console.log('Navigated to issue page. Automated click logic starts here.');
        // This part requires a "Session Warmer" turn where you log in via a non-headless browser once.

        await browser.close();
        return true;
    } catch (err) {
        console.error('Puppeteer Apply Error:', err);
        await browser.close();
        return false;
    }
}
