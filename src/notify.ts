import axios from 'axios';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendDiscord(content: string) {
    if (!DISCORD_WEBHOOK_URL) return;
    try {
        await axios.post(DISCORD_WEBHOOK_URL, { content });
    } catch (err: any) {
        console.error('Discord notification failed:', err.response?.data || err.message);
    }
}

async function sendTelegram(text: string) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
    } catch (err: any) {
        console.error('Telegram notification failed:', err.response?.data || err.message);
    }
}

async function broadcast(message: string) {
    await Promise.all([sendDiscord(message), sendTelegram(message)]);
}

export async function notifyNewOpportunity(opts: {
    title: string;
    repoFullName: string;
    points: number | null;
    complexity: string | null;
    pendingApplicationsCount: number;
    githubIssueUrl: string;
    pitch: string | null;
}) {
    const lines = [
        `🎯 **New Drip Wave opportunity**`,
        `**${opts.title}** — ${opts.repoFullName}`,
        `Points: ${opts.points ?? '?'} | Complexity: ${opts.complexity ?? '?'} | Pending applicants: ${opts.pendingApplicationsCount}`,
        opts.githubIssueUrl
    ];
    if (opts.pitch) {
        lines.push('', '_Suggested pitch:_', opts.pitch);
    }
    await broadcast(lines.join('\n'));
}

export async function notifyAssigned(opts: { title: string; githubIssueUrl: string }) {
    await broadcast([`✅ **Issue assigned to you**`, opts.title, opts.githubIssueUrl].join('\n'));
}

export async function notifyEarned(opts: { title: string; points: number; githubIssueUrl: string }) {
    await broadcast(
        [`💰 **Points earned!**`, `${opts.title} — +${opts.points} pts`, opts.githubIssueUrl].join('\n')
    );
}
