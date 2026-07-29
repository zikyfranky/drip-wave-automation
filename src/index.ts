import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { query, run } from './database';
import { startCron } from './cron';
import { runSniperScan } from './sniper';

dotenv.config();

const app = express();
const port = process.env.PORT || 3005;

app.use(express.json());
app.use(express.static('public'));

startCron();

app.get('/api/analytics', async (req, res) => {
    try {
        const stats = await query(`
            SELECT
                COUNT(*) as total_apps,
                SUM(CASE WHEN UPPER(status) IN ('APPLIED', 'ASSIGNED', 'EARNED') THEN 1 ELSE 0 END) as applied,
                SUM(CASE WHEN UPPER(status) = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN UPPER(status) = 'EARNED' THEN 1 ELSE 0 END) as earned,
                SUM(CASE WHEN UPPER(status) = 'EARNED' THEN points ELSE 0 END) as total_points
            FROM applications
        `);
        res.json(stats[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/applications', async (req, res) => {
    try {
        const apps = await query('SELECT * FROM applications ORDER BY applied_at DESC');
        res.json(apps);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// You clicked Apply on Drips yourself - this just stops the Sniper Feed from
// nagging you about an opportunity you've already acted on.
app.post('/api/applications/:id/mark-applied', async (req, res) => {
    try {
        const result = await run(
            `UPDATE applications SET status = 'APPLIED', applied_manually_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND status = 'PENDING'`,
            [req.params.id]
        );
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Not found or not in PENDING state' });
        }
        res.json({ success: true });
    } catch (err: any) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

app.post('/api/sniper/scan', async (req, res) => {
    try {
        await runSniperScan();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Scan failed', details: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    console.log('Drip Wave Command Center live on ' + port);
});
