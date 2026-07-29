import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const COOKIES_PATH = path.resolve(__dirname, '../data/cookies.json');

export async function snipeIssue(issueId: string, pitch: string) {
    console.log(`[Sniper] Starting browser for issue ${issueId}...`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        if (fs.existsSync(COOKIES_PATH)) {
            const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
            await page.setCookie(...cookies);
        } else {
            throw new Error('No session cookies found.');
        }

        const url = `https://www.drips.network/wave/stellar/issue/${issueId}`;
        await page.goto(url, { waitUntil: 'networkidle2' });

        console.log('[Sniper] Searching for Apply button...');
        // Wait for specific Drips components
        await page.waitForSelector('button', { timeout: 10000 });

        const applied = await page.evaluate(async (p) => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const applyBtn = buttons.find(b => b.innerText.includes('Apply'));
            
            if (applyBtn) {
                applyBtn.click();
                // Custom sleep
                await new Promise(r => setTimeout(r, 2000));
                
                const textarea = document.querySelector('textarea');
                if (textarea) {
                    (textarea as HTMLTextAreaElement).value = p;
                    // Trigger change events
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Submit'));
                    if (submitBtn) {
                        // submitBtn.click(); // UNCOMMENT THIS FOR PRODUCTION
                        return 'FORM_FILLED';
                    }
                }
            }
            return 'NOT_FOUND';
        }, pitch);

        console.log(`[Sniper] Result: ${applied}`);
        await browser.close();
        return applied;
    } catch (err) {
        console.error('[Sniper] Fatal error:', err);
        await browser.close();
        return 'ERROR';
    }
}
