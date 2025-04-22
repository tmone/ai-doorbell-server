const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

/**
 * Bridge to the Python face processing utilities
 */
class FaceProcessingBridge {
  constructor() {
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.faceProcessingScriptPath = path.join(__dirname, 'faceProcessingRunner.py');
    
    // Create the Python runner script if it doesn't exist
    this._createRunnerScriptIfNeeded();
  }

  /**
   * Create a Python script that imports and runs the face processing functions
   * This is necessary to properly call the Python functions from Node.js
   */
  _createRunnerScriptIfNeeded() {
    const scriptContent = `#!/usr/bin/env python3
import sys
import json
import base64
import io
import traceback
import os
from faceProcessing import (
    detect_faces_in_image, 
    detect_faces_in_video, 
    cluster_faces,
    validate_face_upload,
    convert_face_to_bytes
)

def main():
    # Read input from stdin
    input_data = json.loads(sys.stdin.read())
    command = input_data.get('command')
    
    try:
        if command == 'validate_upload':
            file_bytes = base64.b64decode(input_data.get('file_bytes'))
            file_type = input_data.get('file_type')
            
            is_valid, faces, clusters, message = validate_face_upload(file_bytes, file_type)
            
            # Convert face images to base64 for JSON serialization
            face_data = []
            for face in faces:
                face_bytes = convert_face_to_bytes(face)
                face_data.append(base64.b64encode(face_bytes).decode('utf-8'))
            
            # Process clusters
            cluster_data = {}
            for cluster_id, cluster in clusters.items():
                cluster_faces = []
                for face_obj in cluster:
                    face_bytes = convert_face_to_bytes(face_obj['face_image'])
                    face_data_base64 = base64.b64encode(face_bytes).decode('utf-8')
                    cluster_faces.append({
                        'image': face_data_base64
                    })
                cluster_data[cluster_id] = cluster_faces
            
            result = {
                'success': True,
                'is_valid': is_valid,
                'faces': face_data,
                'clusters': cluster_data,
                'face_count': len(faces),
                'message': message
            }
            
        else:
            result = {
                'success': False,
                'message': f'Unknown command: {command}'
            }
            
    except Exception as e:
        result = {
            'success': False,
            'message': str(e),
            'traceback': traceback.format_exc()
        }
    
    # Write result to stdout
    sys.stdout.write(json.dumps(result))

if __name__ == '__main__':
    main()
`;
    
    // Write the script if it doesn't exist
    if (!fs.existsSync(this.faceProcessingScriptPath)) {
      fs.writeFileSync(this.faceProcessingScriptPath, scriptContent);
      // Make executable
      fs.chmodSync(this.faceProcessingScriptPath, '755');
    }
  }

  /**
   * Run a Python command with the given inputs
   * @param {Object} inputData - Input data for the Python script
   * @returns {Promise<Object>} - Promise that resolves to the result
   */
  async _runPythonCommand(inputData) {
    return new Promise((resolve, reject) => {
      const process = spawn(this.pythonPath, [this.faceProcessingScriptPath]);
      
      let outputData = '';
      let errorData = '';
      
      process.stdout.on('data', (data) => {
        outputData += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        errorData += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          console.error('Python process error output:', errorData);
          reject(new Error(`Python process exited with code ${code}: ${errorData}`));
          return;
        }
        
        try {
          const result = JSON.parse(outputData);
          resolve(result);
        } catch (error) {
          console.error('Failed to parse Python output:', outputData);
          reject(new Error(`Failed to parse Python output: ${error.message}`));
        }
      });
      
      // Send input to the Python process
      process.stdin.write(JSON.stringify(inputData));
      process.stdin.end();
    });
  }

  /**
   * Save a file to a temporary location
   * @param {Buffer} fileBuffer - File buffer
   * @param {String} extension - File extension
   * @returns {String} - Path to the saved file
   */
  _saveToTempFile(fileBuffer, extension) {
    const tempDir = os.tmpdir();
    const fileName = `${crypto.randomBytes(16).toString('hex')}${extension}`;
    const filePath = path.join(tempDir, fileName);
    
    fs.writeFileSync(filePath, fileBuffer);
    return filePath;
  }

  /**
   * Validate a face upload and extract faces
   * @param {Buffer} fileBuffer - File buffer
   * @param {String} fileType - File type ('image' or 'video')
   * @returns {Promise<Object>} - Promise that resolves to the validation result
   */
  async validateFaceUpload(fileBuffer, fileType) {
    const fileBase64 = fileBuffer.toString('base64');
    
    const inputData = {
      command: 'validate_upload',
      file_bytes: fileBase64,
      file_type: fileType
    };
    
    try {
      const result = await this._runPythonCommand(inputData);
      return result;
    } catch (error) {
      console.error('Error validating face upload:', error);
      throw error;
    }
  }
}

module.exports = new FaceProcessingBridge();