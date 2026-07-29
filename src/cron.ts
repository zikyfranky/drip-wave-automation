import cron from 'node-cron';
import { getAssignedIssues } from './github';
import { db, run, query } from './database';

export function startCron() {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        console.log('Running automated check...');
        
        // 1. Check GitHub for Assignments
        const assigned = await getAssignedIssues();
        for (const issue of assigned) {
            // Update database if we find an assigned issue
            await run(`
                UPDATE applications 
                SET status = 'ASSIGNED', github_url = ? 
                WHERE github_url = ? OR title = ?
            `, [issue.html_url, issue.html_url, issue.title]);
            
            // If it's a new assignment not in our DB, add it
            const exists = await query('SELECT id FROM applications WHERE github_url = ?', [issue.html_url]);
            if (exists.length === 0) {
                await run(`
                    INSERT INTO applications (github_url, title, status, points)
                    VALUES (?, ?, 'ASSIGNED', 100)
                `, [issue.html_url, issue.title]);
            }
        }
        
        console.log('Poll completed.');
    });
}
