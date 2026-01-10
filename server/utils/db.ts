import pg from 'pg';

const { Pool } = pg;

// Use process.env.DATABASE_URL. 
// If using Neon, we generally need SSL enabled.
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false } // Required for most hosted types (including Neon) to work out of the box
});

export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    // console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
};
