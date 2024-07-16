import os
import boto3
from botocore.exceptions import ClientError
import logging
from collections import defaultdict
from media_utils import get_file_type

logger = logging.getLogger(__name__)

def get_s3_client():
    return boto3.client('s3')

def get_bucket_name():
    return os.getenv('S3_BUCKET_NAME')

def upload_to_s3(file_path):
    file_type = get_file_type(file_path)
    s3_client = get_s3_client()
    bucket_name = get_bucket_name()
    object_name = f"public/{file_type}/{os.path.basename(file_path)}"

    try:
        s3_client.upload_file(file_path, bucket_name, object_name)
        logger.info(f"Successfully uploaded {file_path} to {bucket_name}/{object_name}")
        return True
    except ClientError as e:
        logger.error(f"Error uploading {file_path} to S3: {e}")
        return False

def check_unique_filenames(directory_path):
    s3_client = get_s3_client()
    bucket_name = get_bucket_name()
    local_files = defaultdict(list)
    s3_files = set()
    conflicts = defaultdict(list)

    # Collect local files
    for root, _, files in os.walk(directory_path):
        for file in files:
            if file.lower().endswith(('.mp3', '.wav', '.flac', '.mp4', '.avi', '.mov')):
                local_files[file].append(os.path.join(root, file))

    # Collect S3 files
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=bucket_name, Prefix='public/'):
            for obj in page.get('Contents', []):
                s3_files.add(os.path.basename(obj['Key']))
    except ClientError as e:
        logger.error(f"Error accessing S3 bucket: {e}")
        return {}

    # Check for conflicts with S3
    for file in local_files:
        if file in s3_files:
            file_type = 'audio' if file.lower().endswith(('.mp3', '.wav', '.flac')) else 'video'
            conflicts[file].append(f"S3: public/{file_type}/{file}")

    # Check for local conflicts
    for file, paths in local_files.items():
        if len(paths) > 1:
            conflicts[file].extend(paths)

    return conflicts