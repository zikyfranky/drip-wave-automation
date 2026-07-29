import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve(__dirname, '../data/drip_wave.db');

export const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database opening error: ', err);
    } else {
        console.log('Database connected.');
        initialize();
    }
});

const APPLICATION_COLUMNS: Record<string, string> = {
    repo_full_name: 'TEXT',
    complexity: 'TEXT',
    wave_program: 'TEXT',
    pending_applications_count: 'INTEGER',
    pitch: 'TEXT',
    apply_url: 'TEXT',
    notified_at: 'DATETIME',
    assigned_at: 'DATETIME',
    earned_at: 'DATETIME',
    applied_manually_at: 'DATETIME'
};

function initialize() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                drip_issue_id TEXT UNIQUE,
                github_url TEXT,
                title TEXT,
                points INTEGER,
                status TEXT DEFAULT 'PENDING',
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        `);

        // Migrate in existing columns needed by the Drip Sniper / analytics features.
        db.all(`PRAGMA table_info(applications)`, [], (err, rows: any[]) => {
            if (err) {
                console.error('Migration check failed:', err);
                return;
            }
            const existing = new Set(rows.map((r) => r.name));
            for (const [column, type] of Object.entries(APPLICATION_COLUMNS)) {
                if (!existing.has(column)) {
                    db.run(`ALTER TABLE applications ADD COLUMN ${column} ${type}`, (alterErr) => {
                        if (alterErr) console.error(`Failed to add column ${column}:`, alterErr);
                    });
                }
            }
        });
    });
}

export const query = (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

export const run = (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};
