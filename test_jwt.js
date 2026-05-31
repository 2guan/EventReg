import jwt from 'jsonwebtoken';

console.log('jwt object:', jwt);
try {
    const token = jwt.sign({ foo: 'bar' }, 'secret');
    console.log('Signed token:', token);
    const decoded = jwt.verify(token, 'secret');
    console.log('Decoded:', decoded);
} catch (err) {
    console.error('JWT Error:', err);
}
