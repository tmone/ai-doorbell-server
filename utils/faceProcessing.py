import os
import cv2
import numpy as np
import tempfile
import uuid
import time
import face_recognition
from ultralytics import YOLO
from sklearn.cluster import DBSCAN
from moviepy.editor import VideoFileClip
from PIL import Image
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize the YOLO model with a face detection model
# We'll use YOLOv8 face detection model
MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../models/yolov8_face.pt"))
yolo_model = None

def initialize_model():
    """Initialize the YOLO face detection model."""
    global yolo_model
    try:
        # Check if the model file exists
        if not os.path.exists(MODEL_PATH):
            # Download YOLOv8 face detection model
            from ultralytics import download
            os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
            download(url="https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n-face.pt", dir=os.path.dirname(MODEL_PATH))
            os.rename(os.path.join(os.path.dirname(MODEL_PATH), "yolov8n-face.pt"), MODEL_PATH)
        
        yolo_model = YOLO(MODEL_PATH)
        logger.info("YOLO model initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize YOLO model: {str(e)}")
        raise

# Call initialize_model at module load time
initialize_model()

def detect_faces_in_image(image_bytes):
    """
    Detect faces in an image using YOLO
    
    Args:
        image_bytes: Binary image data
        
    Returns:
        faces: List of face images
        face_encodings: List of face encodings
        face_locations: List of face bounding boxes (x1, y1, x2, y2)
        is_human_image: Boolean indicating if human faces were detected
    """
    try:
        # Convert bytes to numpy array
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Run YOLO detection
        results = yolo_model(image_rgb, conf=0.25)
        
        faces = []
        face_encodings = []
        face_locations = []
        
        # Process each detected face
        for result in results:
            boxes = result.boxes.xyxy.cpu().numpy()
            confs = result.boxes.conf.cpu().numpy()
            
            # If no faces detected
            if len(boxes) == 0:
                return [], [], [], False
            
            for i, box in enumerate(boxes):
                # Extract coordinates
                x1, y1, x2, y2 = map(int, box)
                
                # Add some margin around the face
                margin_x = int((x2 - x1) * 0.2)
                margin_y = int((y2 - y1) * 0.2)
                
                # Apply margins with boundary checking
                x1 = max(0, x1 - margin_x)
                y1 = max(0, y1 - margin_y)
                x2 = min(image.shape[1], x2 + margin_x)
                y2 = min(image.shape[0], y2 + margin_y)
                
                # Extract face
                face_img = image_rgb[y1:y2, x1:x2]
                
                # Skip tiny faces
                if face_img.shape[0] < 50 or face_img.shape[1] < 50:
                    continue
                
                # Get face encoding using face_recognition library
                try:
                    # Resize for better encoding performance
                    face_img_resized = cv2.resize(face_img, (0, 0), fx=0.5, fy=0.5)
                    encodings = face_recognition.face_encodings(face_img_resized)
                    if len(encodings) > 0:
                        encoding = encodings[0]
                        faces.append(face_img)
                        face_encodings.append(encoding)
                        face_locations.append((x1, y1, x2, y2))
                except Exception as e:
                    logger.warning(f"Error encoding face: {str(e)}")
                    continue
        
        is_human_image = len(faces) > 0
        return faces, face_encodings, face_locations, is_human_image
    
    except Exception as e:
        logger.error(f"Error detecting faces: {str(e)}")
        return [], [], [], False

def extract_frames_from_video(video_bytes, max_frames=30):
    """
    Extract frames from video for face detection
    
    Args:
        video_bytes: Binary video data
        max_frames: Maximum number of frames to extract
        
    Returns:
        list of frames as numpy arrays
    """
    # Create temporary file to save video
    with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
        temp_path = temp_file.name
        temp_file.write(video_bytes)
    
    try:
        # Open video file
        clip = VideoFileClip(temp_path)
        duration = clip.duration
        
        # Calculate frame interval to extract evenly distributed frames
        if duration <= 0:
            return []
        
        interval = max(1, int(duration / max_frames))
        frames = []
        
        # Extract frames at regular intervals
        for i in range(0, min(int(duration), max_frames * interval), interval):
            frame = clip.get_frame(i)
            frames.append(frame)
        
        clip.close()
        return frames
    
    except Exception as e:
        logger.error(f"Error extracting frames from video: {str(e)}")
        return []
    
    finally:
        # Clean up temp file
        if os.path.exists(temp_path):
            os.remove(temp_path)

def detect_faces_in_video(video_bytes, max_frames=30):
    """
    Detect faces in a video using YOLO
    
    Args:
        video_bytes: Binary video data
        max_frames: Maximum number of frames to process
        
    Returns:
        faces: List of face images
        face_encodings: List of face encodings
        is_human_video: Boolean indicating if human faces were detected
    """
    try:
        frames = extract_frames_from_video(video_bytes, max_frames)
        
        all_faces = []
        all_encodings = []
        
        for frame in frames:
            # Convert frame to bytes
            pil_image = Image.fromarray(frame)
            img_byte_arr = io.BytesIO()
            pil_image.save(img_byte_arr, format='JPEG')
            img_byte_arr = img_byte_arr.getvalue()
            
            # Detect faces in the frame
            faces, encodings, _, _ = detect_faces_in_image(img_byte_arr)
            
            all_faces.extend(faces)
            all_encodings.extend(encodings)
        
        is_human_video = len(all_faces) > 0
        return all_faces, all_encodings, is_human_video
    
    except Exception as e:
        logger.error(f"Error detecting faces in video: {str(e)}")
        return [], [], False

def cluster_faces(face_images, face_encodings, eps=0.5, min_samples=2):
    """
    Cluster faces based on their encodings
    
    Args:
        face_images: List of face image arrays
        face_encodings: List of face encodings
        eps: DBSCAN epsilon parameter (max distance between samples)
        min_samples: DBSCAN min_samples parameter
        
    Returns:
        clusters: Dictionary of clusters containing face images
    """
    if len(face_encodings) == 0:
        return {}
    
    try:
        # Convert face encodings to numpy array
        encodings_array = np.array(face_encodings)
        
        # Perform clustering
        clustering = DBSCAN(eps=eps, min_samples=min_samples, metric="euclidean", n_jobs=-1)
        labels = clustering.fit_predict(encodings_array)
        
        # Group faces by cluster
        clusters = {}
        for i, label in enumerate(labels):
            # Noise is labeled as -1
            cluster_id = f"cluster_{label}" if label >= 0 else "unknown"
            
            if cluster_id not in clusters:
                clusters[cluster_id] = []
            
            clusters[cluster_id].append({
                "face_image": face_images[i],
                "encoding": face_encodings[i]
            })
        
        return clusters
    
    except Exception as e:
        logger.error(f"Error clustering faces: {str(e)}")
        return {
            "unknown": [{"face_image": img, "encoding": enc} for img, enc in zip(face_images, face_encodings)]
        }

def validate_face_upload(file_bytes, file_type):
    """
    Validate that uploaded file contains human faces
    
    Args:
        file_bytes: Binary file data
        file_type: Type of file ('image' or 'video')
        
    Returns:
        is_valid: Boolean indicating if the file contains human faces
        faces: List of extracted face images
        clusters: Dictionary of face clusters
        message: Validation message
    """
    if file_type == 'image':
        faces, encodings, locations, is_human = detect_faces_in_image(file_bytes)
        
        if not is_human:
            return False, [], {}, "No human faces detected in the uploaded image. Please upload an image containing clear human faces."
        
    elif file_type == 'video':
        faces, encodings, is_human = detect_faces_in_video(file_bytes)
        
        if not is_human:
            return False, [], {}, "No human faces detected in the uploaded video. Please upload a video containing clear human faces."
    
    else:
        return False, [], {}, "Unsupported file type. Please upload an image or video."
    
    # If we have faces, cluster them
    if len(faces) > 0:
        clusters = cluster_faces(faces, encodings)
        return True, faces, clusters, f"Successfully extracted {len(faces)} faces from {file_type}."
    else:
        return False, [], {}, f"No faces could be extracted from the {file_type}."

def convert_face_to_bytes(face_img):
    """
    Convert face image array to bytes
    
    Args:
        face_img: Face image as numpy array
        
    Returns:
        bytes: Face image as bytes
    """
    success, encoded_img = cv2.imencode('.jpg', cv2.cvtColor(face_img, cv2.COLOR_RGB2BGR))
    return encoded_img.tobytes() if success else None