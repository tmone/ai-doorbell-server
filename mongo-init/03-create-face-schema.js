// Initialize the ai-doorbell database
db = db.getSiblingDB('ai-doorbell');

// Create Face collection with validation
db.createCollection('faces', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['faceFeatures', 'featureVersion', 'personType', 'personId'],
      properties: {
        primaryImage: {
          bsonType: 'object',
          required: ['data', 'contentType'],
          properties: {
            data: {
              bsonType: 'binData',
              description: 'Binary data of the primary face image'
            },
            contentType: {
              bsonType: 'string',
              description: 'MIME type of the image'
            },
            uploadDate: {
              bsonType: 'date',
              description: 'Date when the image was uploaded'
            }
          }
        },
        additionalImages: {
          bsonType: 'array',
          description: 'List of additional face images',
          items: {
            bsonType: 'object',
            required: ['data', 'contentType'],
            properties: {
              data: {
                bsonType: 'binData',
                description: 'Binary data of the image'
              },
              contentType: {
                bsonType: 'string',
                description: 'MIME type of the image'
              },
              angle: {
                bsonType: 'string',
                enum: ['front', 'left', 'right', 'top', 'bottom'],
                description: 'Angle of the face in the image'
              },
              uploadDate: {
                bsonType: 'date',
                description: 'Date when the image was uploaded'
              }
            }
          }
        },
        faceFeatures: {
          bsonType: 'object',
          description: 'Facial features extracted for recognition'
        },
        featureVersion: {
          bsonType: 'string',
          description: 'Version of the AI model that extracted the features'
        },
        qualityScore: {
          bsonType: 'double',
          minimum: 0,
          maximum: 1,
          description: 'Quality score of the face image for recognition'
        },
        personType: {
          bsonType: 'string',
          enum: ['employee', 'visitor', 'unknown'],
          description: 'Type of person this face belongs to'
        },
        personId: {
          bsonType: 'objectId',
          description: 'ID of the person record this face belongs to'
        },
        active: {
          bsonType: 'bool',
          description: 'Whether this face record is active for recognition'
        },
        lastDetectedDate: {
          bsonType: 'date',
          description: 'Date when this face was last detected'
        },
        // New fields for verification
        verificationStatus: {
          bsonType: 'string',
          enum: ['unverified', 'verified', 'rejected'],
          description: 'The verification status of this face'
        },
        uploadedBy: {
          bsonType: 'objectId',
          description: 'User who uploaded this face'
        },
        verifiedBy: {
          bsonType: 'objectId',
          description: 'User who verified this face'
        },
        verificationDate: {
          bsonType: 'date',
          description: 'Date when this face was verified'
        },
        verificationNote: {
          bsonType: 'string',
          description: 'Note from the verifier'
        },
        proposedLabels: {
          bsonType: 'array',
          description: 'List of labels proposed for this face',
          items: {
            bsonType: 'object',
            properties: {
              label: {
                bsonType: 'string',
                description: 'Proposed label'
              },
              proposedBy: {
                bsonType: 'objectId',
                description: 'User who proposed this label'
              },
              proposedAt: {
                bsonType: 'date',
                description: 'Date when this label was proposed'
              },
              confidence: {
                bsonType: 'double',
                minimum: 0,
                maximum: 1,
                description: 'Confidence score for this label'
              }
            }
          }
        },
        selectedLabel: {
          bsonType: 'string',
          description: 'The label selected for this face'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date of the face record'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update date of the face record'
        }
      }
    }
  }
});

// Create indexes for the Face collection
db.faces.createIndex({ personType: 1, active: 1 });
db.faces.createIndex({ personId: 1, personType: 1 });
db.faces.createIndex({ verificationStatus: 1 });
db.faces.createIndex({ uploadedBy: 1 });

print('Face schema and indexes created successfully!');