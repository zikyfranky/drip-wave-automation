import { getIssueById } from './drips';
import { notifyEarned, notifyAssigned, notifyLost } from './notify';
import { query, run } from './database';

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || '';

/**
 * For issues we discovered via the Sniper and that later got assigned (detected by
 * the existing GitHub poller in cron.ts), checks Drips to see if the issue has been
 * resolved/paid out in a Wave, and if so flips the local record from ASSIGNED to
 * EARNED with the real points awarded.
 *
 * Only covers rows with a drip_issue_id — assignments picked up purely from the
 * generic GitHub "assigned issues" poll (not originating from a Sniper scan) have no
 * reliable way to be mapped back to a Drips issue UUID and are left untouched.
 */
export async function syncDripsStatus() {
    const assigned = await query(
        `SELECT id, drip_issue_id, title, github_url FROM applications
         WHERE status = 'ASSIGNED' AND drip_issue_id IS NOT NULL`
    );

    let updated = 0;
    for (const app of assigned) {
        const issue = await getIssueById(app.drip_issue_id);
        if (!issue) continue;

        const isResolved = Boolean(issue.resolvedInWave || issue.completedAt);
        if (!isResolved) continue;

        const points = issue.pointsEarned ?? issue.points ?? 0;

        await run(
            `UPDATE applications
             SET status = 'EARNED', points = ?, earned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [points, app.id]
        );

        await notifyEarned({ title: app.title, points, githubIssueUrl: app.github_url });
        updated++;
    }

    if (updated > 0) {
        console.log(`Status sync: ${updated} issue(s) moved to EARNED`);
    }
}

/**
 * For issues we marked APPLIED ourselves, checks Drips to see whether the maintainer
 * has since assigned the issue - either to us (ASSIGNED, same as the GitHub poller
 * would eventually catch, just faster) or to someone else (LOST, so the Sniper Feed
 * stops implying it's still up for grabs).
 */
export async function syncAppliedOutcomes() {
    const applied = await query(
        `SELECT id, drip_issue_id, title, github_url FROM applications
         WHERE status = 'APPLIED' AND drip_issue_id IS NOT NULL`
    );

    let assignedCount = 0;
    let lostCount = 0;
    for (const app of applied) {
        const issue = await getIssueById(app.drip_issue_id);
        if (!issue?.assignedApplicant) continue;

        const wonIt = GITHUB_USERNAME &&
            issue.assignedApplicant.gitHubUsername.toLowerCase() === GITHUB_USERNAME.toLowerCase();

        if (wonIt) {
            await run(
                `UPDATE applications SET status = 'ASSIGNED', assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [app.id]
            );
            await notifyAssigned({ title: app.title, githubIssueUrl: app.github_url });
            assignedCount++;
        } else {
            await run(
                `UPDATE applications SET status = 'LOST', lost_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [app.id]
            );
            await notifyLost({ title: app.title, assignedTo: issue.assignedApplicant.gitHubUsername, githubIssueUrl: app.github_url });
            lostCount++;
        }
    }

    if (assignedCount > 0 || lostCount > 0) {
        console.log(`Status sync: ${assignedCount} issue(s) confirmed ASSIGNED, ${lostCount} marked LOST`);
    }
}
