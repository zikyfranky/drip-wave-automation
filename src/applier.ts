import fs from 'fs';
import path from 'path';
import axios from 'axios';

const COOKIES_PATH = path.resolve(__dirname, '../data/cookies.json');

export async function snipeIssue(dripIssueId: string, pitch: string) {
    console.log(`[Sniper API] Direct API apply for issue ${dripIssueId}...`);
    
    try {
        if (!fs.existsSync(COOKIES_PATH)) throw new Error('No cookies.json found');
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        
        const tokenCookie = cookies.find((c: any) => c.name === 'wave_access_token');
        if (!tokenCookie) throw new Error('wave_access_token not found');

        // CORRECT ENDPOINT: Using the UUID
        const url = `https://wave-api.drips.network/wave-programs/stellar/issues/${dripIssueId}/apply`;
        
        const response = await axios.post(url, {
            message: pitch
        }, {
            headers: {
                'Authorization': `Bearer ${tokenCookie.value}`,
                'Content-Type': 'application/json',
                'Origin': 'https://www.drips.network',
                'Referer': 'https://www.drips.network/'
            }
        });

        console.log('[Sniper API] SUCCESS:', response.data);
        return 'SUCCESS';
    } catch (err: any) {
        console.error('[Sniper API] ERROR:', err.response?.data || err.message);
        if (err.response?.status === 409) return 'ALREADY_APPLIED';
        if (err.response?.status === 401) return 'SESSION_EXPIRED';
        return 'ERROR: ' + (err.response?.data?.message || err.message);
    }
}
