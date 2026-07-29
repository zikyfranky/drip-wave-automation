import cron from 'node-cron';
import { exec } from 'child_process';
import { getAssignedIssues, forkRepo } from './github';
import { db, run, query } from './database';
import { generatePitches } from './pitcher';
import path from 'path';

const WORKSPACE_DIR = '/home/zikyfranky-drip-wave/htdocs/drip-wave.zikyfranky.com/workspace';

export function startCron() {
    // Run every 15 minutes
    cron.schedule('*/15 * * * *', async () => {
        console.log('Running automated check...');
        
        try {
            // 1. Sync Assigned Issues
            const assigned = await getAssignedIssues();
            for (const issue of assigned) {
                const [owner, repo] = issue.repository.full_name.split('/');
                const issueId = issue.number;
                const exists = await query('SELECT status FROM applications WHERE github_url = ?', [issue.html_url]);
                
                if (exists.length === 0 || exists[0].status === 'PENDING') {
                    console.log(`New assignment: ${repo} #${issueId}`);
                    await forkRepo(owner, repo);
                    
                    setTimeout(() => {
                        const localPath = path.join(WORKSPACE_DIR, repo);
                        const cloneUrl = `https://github.com/zikyfranky/${repo}.git`;
                        exec(`git clone ${cloneUrl} ${localPath} && cd ${localPath} && git checkout -b fix/drip-issue-${issueId}`, (err) => {
                            if (err) console.error('Workspace setup error:', err);
                        });
                    }, 10000);

                    if (exists.length === 0) {
                        await run(`INSERT INTO applications (github_url, title, status, points) VALUES (?, ?, 'ASSIGNED', 150)`, [issue.html_url, issue.title]);
                    } else {
                        await run('UPDATE applications SET status = "ASSIGNED" WHERE github_url = ?', [issue.html_url]);
                    }
                }
            }

            // 2. Generate Pitches for any new Pending issues
            await generatePitches();

        } catch (err) {
            console.error('Cron error:', err);
        }
    });
}
