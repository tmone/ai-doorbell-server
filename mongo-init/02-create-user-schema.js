// Initialize the ai-doorbell database
db = db.getSiblingDB('ai-doorbell');

// Create User collection with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'email', 'password', 'role'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Name must be a string and is required'
        },
        email: {
          bsonType: 'string',
          description: 'Email must be a string and is required',
          pattern: '^\\w+([\\.-]?\\w+)*@\\w+([\\.-]?\\w+)*(\\.\\w{2,3})+$'
        },
        password: {
          bsonType: 'string',
          description: 'Password must be a string and is required',
          minLength: 6
        },
        role: {
          bsonType: 'string',
          description: 'Role must be one of the allowed values',
          enum: ['admin', 'manager', 'user']
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date of the user'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update date of the user'
        }
      }
    }
  }
});

// Create indexes for the User collection
db.users.createIndex({ email: 1 }, { unique: true });

print('User schema and indexes created successfully!');