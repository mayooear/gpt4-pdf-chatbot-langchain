import os
import boto3
from botocore.exceptions import ClientError

def upload_to_s3(file_path):
    s3_client = boto3.client('s3')
    bucket_name = os.getenv('S3_BUCKET_NAME')
    object_name = os.path.basename(file_path)

    try:
        s3_client.upload_file(file_path, bucket_name, object_name)
        print(f"Successfully uploaded {file_path} to {bucket_name}/{object_name}")
        return True
    except ClientError as e:
        print(f"Error uploading {file_path} to S3: {e}")
        return False

def check_unique_filenames(directory_path):
    s3_client = boto3.client('s3',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION')
    )
    bucket_name = os.getenv('S3_BUCKET_NAME')
    local_files = set(os.listdir(directory_path))
    
    try:
        s3_objects = s3_client.list_objects_v2(Bucket=bucket_name)
        s3_files = set(obj['Key'] for obj in s3_objects.get('Contents', []))
    except ClientError as e:
        print(f"Error listing objects in S3 bucket: {e}")
        return False

    duplicate_files = local_files.intersection(s3_files)
    
    if duplicate_files:
        print("Warning: The following files already exist in the S3 bucket:")
        for file in duplicate_files:
            print(f"- {file}")
        return False
    
    return True