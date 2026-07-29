import cron from 'node-cron';
import { exec } from 'child_process';
import { getAssignedIssues, forkRepo } from './github';
import { run, query } from './database';
import { runSniperScan } from './sniper';
import { syncDripsStatus } from './status-sync';
import { notifyAssigned } from './notify';
import path from 'path';

const WORKSPACE_DIR = '/home/zikyfranky-drip-wave/htdocs/drip-wave.zikyfranky.com/workspace';

export function startCron() {
    // Speed matters for sniping newly-posted issues before other contributors do,
    // so this runs more often than the GitHub assignment/status checks below.
    cron.schedule('*/5 * * * *', async () => {
        try {
            await runSniperScan();
        } catch (err) {
            console.error('Sniper scan error:', err);
        }
    });

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
                        await run(`INSERT INTO applications (github_url, title, status, points, assigned_at) VALUES (?, ?, 'ASSIGNED', 150, CURRENT_TIMESTAMP)`, [issue.html_url, issue.title]);
                    } else {
                        await run('UPDATE applications SET status = "ASSIGNED", assigned_at = CURRENT_TIMESTAMP WHERE github_url = ?', [issue.html_url]);
                    }

                    await notifyAssigned({ title: issue.title, githubIssueUrl: issue.html_url });
                }
            }

            await syncDripsStatus();
        } catch (err) {
            console.error('Cron error:', err);
        }
    });
}
