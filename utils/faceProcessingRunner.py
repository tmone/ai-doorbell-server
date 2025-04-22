#!/usr/bin/env python3
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
