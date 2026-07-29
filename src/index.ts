import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { query } from './database';
import { startCron } from './cron';

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
                SUM(points) as total_points
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

app.get('/', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    console.log(`Drip Wave Dashboard running on port ${port}`);
});
