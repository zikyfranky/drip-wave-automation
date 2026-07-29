import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_USER = process.env.GITHUB_USERNAME;

const api = axios.create({
    baseURL: 'https://api.github.com',
    headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json'
    }
});

export async function getAssignedIssues() {
    try {
        const res = await api.get('/issues', {
            params: { filter: 'assigned', state: 'open' }
        });
        return res.data;
    } catch (err) {
        console.error('GitHub API error:', err);
        return [];
    }
}

export async function forkRepo(owner: string, repo: string) {
    try {
        const res = await api.post(`/repos/${owner}/${repo}/forks`);
        return res.data;
    } catch (err) {
        console.error('Forking error:', err);
    }
}

export async function createPR(owner: string, repo: string, title: string, head: string, base: string, body: string) {
    try {
        const res = await api.post(`/repos/${owner}/${repo}/pulls`, {
            title, head, base, body
        });
        return res.data;
    } catch (err) {
        console.error('PR creation error:', err);
    }
}
