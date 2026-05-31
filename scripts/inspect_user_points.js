
import Database from 'better-sqlite3';

const db = new Database('sportsreg.db');

try {
    console.log('=== User 1 Points Inspection ===');
    const points = db.prepare('SELECT * FROM points WHERE user_id = 1').all();
    console.log(JSON.stringify(points, null, 2));

    const sum = points.reduce((acc, p) => acc + p.amount, 0);
    console.log(`Total Calculated Sum: ${sum}`);

} catch (error) {
    console.error(error);
}
