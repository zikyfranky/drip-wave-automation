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

app.post('/api/sniper/scan', async (req, res) => {
    try {
        await runSniperScan();
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Scan failed', details: err.message });
    }
});

app.post('/api/snipe/:id', async (req, res) => {
    const id = req.params.id;
    try {
        const rows = await query('SELECT * FROM applications WHERE id = ?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Not found' });
        
        // Use the Drip Issue UUID from the DB
        const result = await snipeIssue(rows[0].drip_issue_id, rows[0].pitch);
        
        res.json({ status: result });
    } catch (e) {
        console.error('Snipe API Error:', e);
        res.status(500).json({ error: 'Snipe engine error' });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    console.log('Drip Wave Command Center live on ' + port);
});
