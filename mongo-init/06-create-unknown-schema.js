// Initialize the ai-doorbell database
db = db.getSiblingDB('ai-doorbell');

// Create Unknown Persons collection with validation
db.createCollection('unknownpersons', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['faceId', 'detections'],
      properties: {
        faceId: {
          bsonType: 'objectId',
          description: 'ID of the face record for this unknown person'
        },
        detections: {
          bsonType: 'array',
          description: 'List of detection records',
          items: {
            bsonType: 'object',
            required: ['timestamp', 'location', 'deviceId'],
            properties: {
              timestamp: {
                bsonType: 'date',
                description: 'Time of detection'
              },
              confidenceScore: {
                bsonType: 'double',
                minimum: 0,
                maximum: 1,
                description: 'Confidence score of the detection'
              },
              location: {
                bsonType: 'string',
                description: 'Location where person was detected'
              },
              deviceId: {
                bsonType: 'string',
                description: 'ID of device that made the detection'
              },
              alertSent: {
                bsonType: 'bool',
                description: 'Whether an alert was sent for this detection'
              },
              alertRecipients: {
                bsonType: 'array',
                items: {
                  bsonType: 'objectId',
                  description: 'Users who received alerts'
                }
              },
              notes: {
                bsonType: 'string',
                description: 'Notes about the detection'
              }
            }
          }
        },
        threatLevel: {
          bsonType: 'string',
          enum: ['low', 'medium', 'high', 'none'],
          description: 'Assessed threat level of this unknown person'
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'identified', 'false-positive', 'archived'],
          description: 'Current status of this unknown person'
        },
        possibleMatches: {
          bsonType: 'array',
          description: 'List of possible matches to known people',
          items: {
            bsonType: 'object',
            required: ['personType', 'personId', 'confidenceScore'],
            properties: {
              personType: {
                bsonType: 'string',
                enum: ['employee', 'visitor'],
                description: 'Type of person this might match'
              },
              personId: {
                bsonType: 'objectId',
                description: 'ID of the possibly matched person'
              },
              confidenceScore: {
                bsonType: 'double',
                minimum: 0,
                maximum: 1,
                description: 'Confidence score of the match'
              }
            }
          }
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date of the unknown person record'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update date of the unknown person record'
        }
      }
    }
  }
});

// Create indexes for the Unknown Person collection
db.unknownpersons.createIndex({ faceId: 1 }, { unique: true });
db.unknownpersons.createIndex({ 'detections.timestamp': 1 });
db.unknownpersons.createIndex({ threatLevel: 1 });
db.unknownpersons.createIndex({ status: 1 });

print('Unknown Person schema and indexes created successfully!');