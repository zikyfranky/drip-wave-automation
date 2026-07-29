import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { query } from './database';
import { startCron } from './cron';
import { runSniperScan } from './sniper';

dotenv.config();

const app = express();
const port = process.env.PORT || 3005;

app.use(express.json());
app.use(express.static('public'));

// Start Automation Cron
startCron();

app.get('/api/analytics', async (req, res) => {
    try {
        const stats = await query(`
            SELECT
                COUNT(*) as total_apps,
                SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN status = 'EARNED' THEN 1 ELSE 0 END) as earned,
                SUM(CASE WHEN status = 'EARNED' THEN points ELSE 0 END) as total_points
            FROM applications
        `);

        const assignedOrEarned = await query(`
            SELECT status FROM applications WHERE status IN ('ASSIGNED', 'EARNED')
        `);
        const earnedCount = assignedOrEarned.filter((r: any) => r.status === 'EARNED').length;
        const successRate = assignedOrEarned.length > 0
            ? Math.round((earnedCount / assignedOrEarned.length) * 1000) / 10
            : null;

        const completed = await query(`
            SELECT points, assigned_at, earned_at FROM applications
            WHERE status = 'EARNED' AND assigned_at IS NOT NULL AND earned_at IS NOT NULL
        `);
        let totalHours = 0;
        let totalCompletedPoints = 0;
        for (const row of completed) {
            const hours = (new Date(row.earned_at).getTime() - new Date(row.assigned_at).getTime()) / 3_600_000;
            if (hours > 0) {
                totalHours += hours;
                totalCompletedPoints += row.points || 0;
            }
        }
        const pointsPerHour = totalHours > 0 ? Math.round((totalCompletedPoints / totalHours) * 10) / 10 : null;

        const byComplexity = await query(`
            SELECT complexity, COUNT(*) as count, SUM(CASE WHEN status = 'EARNED' THEN points ELSE 0 END) as points
            FROM applications
            WHERE complexity IS NOT NULL
            GROUP BY complexity
        `);

        res.json({
            ...(stats[0] || {}),
            success_rate: successRate,
            points_per_hour: pointsPerHour,
            by_complexity: byComplexity
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/applications', async (req, res) => {
    try {
        const apps = await query(
            `SELECT * FROM applications WHERE status != 'PENDING' ORDER BY applied_at DESC`
        );
        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Issues the Sniper found but that haven't been assigned yet - still need a human to
// click Apply on Drips/GitHub.
app.get('/api/opportunities', async (req, res) => {
    try {
        const opportunities = await query(
            `SELECT * FROM applications WHERE status = 'PENDING' ORDER BY points DESC, applied_at DESC`
        );
        res.json(opportunities);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Manual trigger, useful for testing without waiting on the cron schedule.
app.post('/api/sniper/scan', async (req, res) => {
    try {
        await runSniperScan();
        res.json({ ok: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message || 'Sniper scan failed' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    console.log(`Drip Wave Dashboard running on port ${port}`);
});
