const { initDatabase } = require('./models/database');

console.log('Initializing database...');
initDatabase();
console.log('Database initialization complete!');
