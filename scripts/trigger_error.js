const fetch = require('node-fetch'); // Needs node-fetch installed or use built-in global fetch if node 18+
// My environment might not have node-fetch installed.
// I'll try using 'http' module to be safe or assuming Node 18+ (fetch global).
// Actually better, I'll use built-in http request.

const http = require('http');

function postRequest(path, data, token) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api' + path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                ...(token ? { 'Authorization': 'Bearer ' + token } : {})
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginData = JSON.stringify({ username: 'admin', password: 'adminpassword' }); // Assuming admin exists
        // Or create a user? I'll try admin first.
        const loginRes = await postRequest('/auth/login', loginData);
        if (loginRes.statusCode !== 200) {
            console.error('Login failed:', loginRes.body);
            return;
        }
        const token = JSON.parse(loginRes.body).token;
        console.log('Login success. Token acquired.');

        // 2. Join
        console.log('Attempting Join...');
        // Match 1 usually exists?
        const joinData = JSON.stringify({
            match_id: 1,
            type: 'player',
            enrolled_for_name: 'DebugGuest'
        });
        const joinRes = await postRequest('/enrollments/join', joinData, token);
        console.log('Join Status:', joinRes.statusCode);
        console.log('Join Body:', joinRes.body);

    } catch (err) {
        console.error('Script error:', err);
    }
}

run();
