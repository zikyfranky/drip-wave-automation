import axios from 'axios';

const api = axios.create({
    baseURL: 'https://wave-api.drips.network/api',
    timeout: 15000
});

export interface DripsWaveProgram {
    id: string;
    name: string;
    slug: string;
    repoApplicationsLimitPerUser: number;
    repoApplicationsLimitPerOrg: number;
}

export interface DripsIssue {
    id: string;
    gitHubIssueNumber: number;
    title: string;
    body: string;
    state: 'open' | 'closed';
    labels: { name: string }[];
    repo: {
        gitHubRepoFullName: string;
        gitHubRepoUrl: string;
    };
    waveProgramId: string | null;
    pendingApplicationsCount: number;
    assignedApplicant: { gitHubUsername: string } | null;
    complexity: string | null;
    points: number | null;
    pointsEarned: number | null;
    prLink: string | null;
    resolvedInWave: string | null;
    completedAt: string | null;
}

// The public GraphQL API at gql-api.drips.network is read-only and unrelated to Wave
// bounties. Wave issue discovery lives on this separate REST service instead.
export async function getWavePrograms(): Promise<DripsWaveProgram[]> {
    const res = await api.get('/wave-programs');
    return res.data.data;
}

export async function getWaveProgramBySlug(slug: string): Promise<DripsWaveProgram | undefined> {
    const programs = await getWavePrograms();
    return programs.find((p) => p.slug === slug);
}

interface AvailableIssueOptions {
    minPoints?: number;
    maxPendingApplications?: number;
    maxPages?: number;
}

/**
 * Fetches open issues for a Wave program and filters, client-side, down to ones that
 * are genuinely up for grabs: open, unassigned, not yet resolved, meeting the point
 * and competitiveness thresholds. Only a handful of query params are validated by the
 * server (confirmed via its zod error responses); availability isn't one of them.
 */
export async function getAvailableIssues(
    waveProgramId: string,
    options: AvailableIssueOptions = {}
): Promise<DripsIssue[]> {
    const { minPoints = 0, maxPendingApplications = Infinity, maxPages = 5 } = options;
    const available: DripsIssue[] = [];

    for (let page = 1; page <= maxPages; page++) {
        const res = await api.get('/issues', {
            params: {
                waveProgramId,
                state: 'open',
                sortBy: 'points',
                sortOrder: 'desc',
                page,
                limit: 100
            }
        });

        const issues: DripsIssue[] = res.data.data;
        if (issues.length === 0) break;

        for (const issue of issues) {
            const isAvailable =
                issue.state === 'open' &&
                !issue.assignedApplicant &&
                !issue.resolvedInWave &&
                !issue.completedAt &&
                (issue.points ?? 0) >= minPoints &&
                issue.pendingApplicationsCount < maxPendingApplications;

            if (isAvailable) available.push(issue);
        }

        if (!res.data.pagination?.hasNextPage) break;
    }

    return available;
}

export async function getIssueById(id: string): Promise<DripsIssue | null> {
    try {
        const res = await api.get(`/issues/${id}`);
        return res.data;
    } catch (err: any) {
        if (err.response?.status === 404) return null;
        throw err;
    }
}

export function buildApplyLinks(issue: DripsIssue, waveProgramSlug: string) {
    return {
        githubIssueUrl: `${issue.repo.gitHubRepoUrl}/issues/${issue.gitHubIssueNumber}`,
        wavePageUrl: `https://www.drips.network/wave/${waveProgramSlug}`
    };
}
