
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const COOKIES_PATH = path.resolve(__dirname, '../data/cookies.json');

export async function snipeIssue(issueId: string, pitch: string) {
    console.log(`[Sniper API] Starting direct application for issue ${issueId}...`);
    
    try {
        if (!fs.existsSync(COOKIES_PATH)) throw new Error('No cookies.json found');
        const cookies = JSON.parse(fs.readFileSync(COOKIES_PATH, 'utf8'));
        
        // Find the JWT from wave_access_token
        const tokenCookie = cookies.find((c: any) => c.name === 'wave_access_token');
        if (!tokenCookie) throw new Error('wave_access_token not found in cookies');

        // Note: Drips usually expects application through their REST API
        // POST https://wave-api.drips.network/wave-programs/stellar/issues/{issueId}/apply
        const url = `https://wave-api.drips.network/wave-programs/stellar/issues/${issueId}/apply`;
        
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

        console.log('[Sniper API] Success:', response.data);
        return 'SUCCESS';
    } catch (err: any) {
        console.error('[Sniper API] Error:', err.response?.data || err.message);
        // If it returns a conflict, we might already have applied
        if (err.response?.status === 409) return 'ALREADY_APPLIED';
        return 'ERROR: ' + (err.response?.data?.message || err.message);
    }
}
