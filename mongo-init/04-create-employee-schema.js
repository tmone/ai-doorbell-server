// Initialize the ai-doorbell database
db = db.getSiblingDB('ai-doorbell');

// Create Employees collection with validation
db.createCollection('employees', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['employeeId', 'name', 'email', 'phone', 'department', 'position', 'faceId'],
      properties: {
        employeeId: {
          bsonType: 'string',
          description: 'Employee ID must be a string and is required'
        },
        name: {
          bsonType: 'string',
          description: 'Name must be a string and is required'
        },
        email: {
          bsonType: 'string',
          description: 'Email must be a string and is required',
          pattern: '^\\w+([\\.-]?\\w+)*@\\w+([\\.-]?\\w+)*(\\.\\w{2,3})+$'
        },
        phone: {
          bsonType: 'string',
          description: 'Phone number must be a string and is required'
        },
        department: {
          bsonType: 'string',
          description: 'Department must be a string and is required'
        },
        position: {
          bsonType: 'string',
          description: 'Position must be a string and is required'
        },
        faceId: {
          bsonType: 'objectId',
          description: 'ID of the face record for this employee'
        },
        attendance: {
          bsonType: 'array',
          description: 'List of attendance records',
          items: {
            bsonType: 'object',
            properties: {
              entryTime: {
                bsonType: ['date', 'null'],
                description: 'Time when employee entered'
              },
              exitTime: {
                bsonType: ['date', 'null'],
                description: 'Time when employee exited'
              },
              date: {
                bsonType: 'date',
                description: 'Date of the attendance record'
              },
              status: {
                bsonType: 'string',
                enum: ['present', 'absent', 'late', 'half-day'],
                description: 'Attendance status'
              }
            }
          }
        },
        joiningDate: {
          bsonType: 'date',
          description: 'Date when employee joined'
        },
        active: {
          bsonType: 'bool',
          description: 'Whether employee is currently active'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Creation date of the employee record'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update date of the employee record'
        }
      }
    }
  }
});

// Create indexes for the Employee collection
db.employees.createIndex({ employeeId: 1 }, { unique: true });
db.employees.createIndex({ email: 1 }, { unique: true });
db.employees.createIndex({ faceId: 1 }, { unique: true });
db.employees.createIndex({ department: 1 });

print('Employee schema and indexes created successfully!');