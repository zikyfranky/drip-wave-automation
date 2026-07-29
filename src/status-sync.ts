import { getIssueById } from './drips';
import { notifyEarned } from './notify';
import { query, run } from './database';

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
