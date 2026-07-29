import { getWaveProgramBySlug, getAvailableIssues, buildApplyLinks, DripsIssue } from './drips';
import { generatePitch } from './pitch';
import { notifyNewOpportunity } from './notify';
import { query, run } from './database';

const WAVE_PROGRAM_SLUG = process.env.DRIPS_WAVE_PROGRAM_SLUG || 'stellar';
const MIN_POINTS = Number(process.env.DRIPS_MIN_POINTS || 100);
const MAX_PENDING_APPLICATIONS = Number(process.env.DRIPS_MAX_PENDING_APPLICATIONS || 3);
const MAX_NOTIFICATIONS_PER_RUN = Number(process.env.SNIPER_MAX_NOTIFICATIONS_PER_RUN || 5);
const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'contributor';

/**
 * Scans the configured Drips Wave program for newly-available, high-value issues,
 * drafts a pitch for each, records them as PENDING opportunities, and notifies.
 *
 * Deliberately stops short of submitting the "Apply" mutation itself — see
 * project notes on the CAPTCHA gate and Wave Terms & Rules around automation.
 * The human still clicks Apply; this just gets them there first with a pitch ready.
 */
export async function runSniperScan() {
    const program = await getWaveProgramBySlug(WAVE_PROGRAM_SLUG);
    if (!program) {
        console.error(`Sniper: wave program "${WAVE_PROGRAM_SLUG}" not found`);
        return;
    }

    const issues = await getAvailableIssues(program.id, {
        minPoints: MIN_POINTS,
        maxPendingApplications: MAX_PENDING_APPLICATIONS
    });

    // Rank: fewer competing applications and higher points sort first.
    issues.sort((a, b) => {
        const scoreA = (a.points ?? 0) / (1 + a.pendingApplicationsCount);
        const scoreB = (b.points ?? 0) / (1 + b.pendingApplicationsCount);
        return scoreB - scoreA;
    });

    let notified = 0;
    for (const issue of issues) {
        if (notified >= MAX_NOTIFICATIONS_PER_RUN) break;

        const seen = await query('SELECT id FROM applications WHERE drip_issue_id = ?', [issue.id]);
        if (seen.length > 0) continue;

        await recordOpportunity(issue, program.slug);
        notified++;
    }

    if (notified > 0) {
        console.log(`Sniper: found ${notified} new opportunit${notified === 1 ? 'y' : 'ies'}`);
    }
}

async function recordOpportunity(issue: DripsIssue, waveProgramSlug: string) {
    const { githubIssueUrl, dripsIssueUrl } = buildApplyLinks(issue, waveProgramSlug);
    const pitch = await generatePitch(issue, GITHUB_USERNAME);

    await run(
        // github_url stays the GitHub link - cron.ts matches on it against the GitHub
        // "assigned issues" poll to detect when this opportunity turns into a real
        // assignment. apply_url is the Drips page, which is where Apply actually is.
        `INSERT INTO applications
            (drip_issue_id, github_url, title, points, status, repo_full_name, complexity,
             wave_program, pending_applications_count, pitch, apply_url, notified_at)
         VALUES (?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [
            issue.id,
            githubIssueUrl,
            issue.title,
            issue.points,
            issue.repo.gitHubRepoFullName,
            issue.complexity,
            waveProgramSlug,
            issue.pendingApplicationsCount,
            pitch,
            dripsIssueUrl
        ]
    );

    await notifyNewOpportunity({
        title: issue.title,
        repoFullName: issue.repo.gitHubRepoFullName,
        points: issue.points,
        complexity: issue.complexity,
        pendingApplicationsCount: issue.pendingApplicationsCount,
        dripsIssueUrl,
        pitch
    });
}
