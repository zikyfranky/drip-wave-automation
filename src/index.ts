import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { query, run } from './database';
import { startCron } from './cron';
import { snipeIssue } from './applier';
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
                SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) as assigned,
                SUM(CASE WHEN status = 'EARNED' THEN 1 ELSE 0 END) as earned,
                SUM(CASE WHEN status = 'EARNED' THEN points ELSE 0 END) as total_points
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

app.get('/api/opportunities', async (req, res) => {
    try {
        const ops = await query('SELECT * FROM applications WHERE status = "PENDING" ORDER BY points DESC');
        res.json(ops);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/sniper/scan', async (req, res) => {
    try {
        console.log('Manual scan triggered...');
        const stats = await runSniperScan();
        res.json(stats || { success: true });
    } catch (err) {
        console.error('Scan failed:', err);
        res.status(500).json({ error: 'Scan failed', details: err.message });
    }
});

app.post('/api/snipe/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const rows = await query('SELECT * FROM applications WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        
        const issueId = rows[0].github_url.split('/').pop();
        const result = await snipeIssue(issueId, rows[0].pitch);
        
        res.json({ status: result });
    } catch (e) {
        console.error('Snipe API error:', e);
        res.status(500).json({ error: 'Snipe failed' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    console.log('Drip Wave Hub running on port ' + port);
});
