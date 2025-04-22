// This script creates a database user for the application
db = db.getSiblingDB('ai-doorbell');

// Create application user with appropriate permissions
db.createUser({
  user: 'ai-doorbell-user',
  pwd: 'doorbell-password',
  roles: [
    { role: 'readWrite', db: 'ai-doorbell' },
    { role: 'dbAdmin', db: 'ai-doorbell' }
  ]
});

// Create an admin user for direct interaction with the database
db.createUser({
  user: 'ai-doorbell-admin',
  pwd: 'admin-doorbell-password',
  roles: [
    { role: 'userAdmin', db: 'ai-doorbell' },
    { role: 'dbOwner', db: 'ai-doorbell' }
  ]
});

print('Database users created successfully!');