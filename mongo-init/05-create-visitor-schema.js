// Initialize the ai-doorbell database
db = db.getSiblingDB('ai-doorbell');

// Create Visitors collection with validation
db.createCollection('visitors', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'faceId'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Name must be a string and is required'
        },
        email: {
          bsonType: 'string',
          description: 'Email must be a string if provided',
          pattern: '^\\w+([\\.-]?\\w+)*@\\w+([\\.-]?\\w+)*(\\.\\w{2,3})+$'
        },
        phone: {
          bsonType: 'string',
          description: 'Phone number'
        },
        company: {
          bsonType: 'string',
          description: 'Company name'
        },
        faceId: {
          bsonType: 'objectId',
          description: 'ID of the face record for this visitor'
        },
        category: {
          bsonType: 'string',
          enum: ['business', 'personal', 'delivery', 'service', 'other'],
          description: 'Category of visitor'
        },
        visits: {
          bsonType: 'array',
          description: 'List of visit records',
          items: {
            bsonType: 'object',
            required: ['entryTime', 'purpose'],
            properties: {
              entryTime: {
                bsonType: 'date',
                description: 'Time when visitor entered'
              },
              exitTime: {
                bsonType: ['date', 'null'],
                description: 'Time when visitor exited'
              },
              purpose: {
                bsonType: 'string',
                description: 'Purpose of visit'
              },
              notes: {
                bsonType: 'string',
                description: 'Notes about the visit'
              },
              metWith: {
                bsonType: 'array',
                items: {
                  bsonType: 'objectId',
                  description: 'Employees met during the visit'
                }
              }
            }
          }
        },
        regularVisitor: {
          bsonType: 'bool',
          description: 'Whether visitor is a regular visitor'
        },
        blacklisted: {
          bsonType: 'bool',
          description: 'Whether visitor is blacklisted'
        },
        blacklistReason: {
          bsonType: 'string',
          description: 'Reason for blacklisting'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date of the visitor record'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update date of the visitor record'
        }
      }
    }
  }
});

// Create indexes for the Visitor collection
db.visitors.createIndex({ name: 1 });
db.visitors.createIndex({ email: 1 });
db.visitors.createIndex({ faceId: 1 }, { unique: true });
db.visitors.createIndex({ company: 1 });
db.visitors.createIndex({ blacklisted: 1 });

print('Visitor schema and indexes created successfully!');