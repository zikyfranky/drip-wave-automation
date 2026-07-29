import cron from 'node-cron';
import { exec } from 'child_process';
import { getAssignedIssues, forkRepo } from './github';
import { db, run, query } from './database';
import path from 'path';

const WORKSPACE_DIR = '/home/zikyfranky-drip-wave/htdocs/drip-wave.zikyfranky.com/workspace';

export function startCron() {
    cron.schedule('*/15 * * * *', async () => {
        console.log('Running automated check...');
        
        try {
            const assigned = await getAssignedIssues();
            for (const issue of assigned) {
                const [owner, repo] = issue.repository.full_name.split('/');
                const issueId = issue.number;
                
                const exists = await query('SELECT status FROM applications WHERE github_url = ?', [issue.html_url]);
                
                if (exists.length === 0 || exists[0].status === 'PENDING') {
                    console.log(`New assignment: ${repo} #${issueId}`);
                    
                    // 1. Fork
                    await forkRepo(owner, repo);
                    
                    // 2. Clone locally after a small delay for fork to be ready
                    setTimeout(() => {
                        const localPath = path.join(WORKSPACE_DIR, repo);
                        const cloneUrl = `https://github.com/zikyfranky/${repo}.git`;
                        
                        exec(`git clone ${cloneUrl} ${localPath} && cd ${localPath} && git checkout -b fix/drip-issue-${issueId}`, (err) => {
                            if (err) console.error('Workspace setup error:', err);
                            else console.log(`Workspace ready at ${localPath}`);
                        });
                    }, 10000);

                    // 3. Update DB
                    if (exists.length === 0) {
                        await run(`INSERT INTO applications (github_url, title, status, points) VALUES (?, ?, 'ASSIGNED', 150)`, [issue.html_url, issue.title]);
                    } else {
                        await run('UPDATE applications SET status = "ASSIGNED" WHERE github_url = ?', [issue.html_url]);
                    }
                }
            }
        } catch (err) {
            console.error('Cron error:', err);
        }
    });
}
