import axios from 'axios';
import { DripsIssue } from './drips';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const anthropic = axios.create({
    baseURL: 'https://api.anthropic.com/v1',
    timeout: 30000,
    headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
    }
});

/**
 * Drafts a short "why I'm a good fit" pitch for a Drips Wave issue application.
 * Returns null (rather than throwing) when no API key is configured, so callers
 * can treat pitch generation as a soft-optional enhancement, not a hard dependency.
 */
export async function generatePitch(issue: DripsIssue, githubUsername: string): Promise<string | null> {
    if (!ANTHROPIC_API_KEY) return null;

    const labels = issue.labels.map((l) => l.name).join(', ') || 'none';

    try {
        const res = await anthropic.post('/messages', {
            model: ANTHROPIC_MODEL,
            max_tokens: 300,
            messages: [
                {
                    role: 'user',
                    content: [
                        `Write a short (3-5 sentence) "why I'm a good fit" application pitch for a GitHub contributor named ${githubUsername}`,
                        `applying to solve an open-source issue for Drips Wave bounty points.`,
                        `Be specific about the issue, concise, and avoid generic filler like "I am passionate about open source."`,
                        `Do not use placeholders like [X] - if you don't know a specific detail, omit it rather than inventing one.`,
                        ``,
                        `Issue title: ${issue.title}`,
                        `Repo: ${issue.repo.gitHubRepoFullName}`,
                        `Labels: ${labels}`,
                        `Complexity: ${issue.complexity ?? 'unspecified'} (${issue.points ?? '?'} points)`,
                        `Issue body:`,
                        issue.body.slice(0, 3000)
                    ].join('\n')
                }
            ]
        });

        const text = res.data?.content?.[0]?.text;
        return typeof text === 'string' ? text.trim() : null;
    } catch (err: any) {
        console.error('Pitch generation failed:', err.response?.data || err.message);
        return null;
    }
}
