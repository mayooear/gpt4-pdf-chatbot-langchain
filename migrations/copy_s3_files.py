#!/usr/bin/env python

import os
import argparse
from dotenv import load_dotenv
import boto3
from botocore.exceptions import ClientError

# Determine the directory of the script
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '../.env')

# Load environment variables from .env file
load_dotenv(env_path)

def initialize_s3_client():
    try:
        return boto3.client('s3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
        )
    except Exception as e:
        raise RuntimeError(f"Error initializing S3 client: {e}")

def copy_s3_files(s3_client, source_bucket, source_prefix, dest_bucket, dest_prefix, dry_run=False):
    try:
        paginator = s3_client.get_paginator('list_objects_v2')
        page_iterator = paginator.paginate(Bucket=source_bucket, Prefix=source_prefix)

        for page in page_iterator:
            if 'Contents' in page:
                for obj in page['Contents']:
                    source_key = obj['Key']
                    
                    # Skip if the object is a top-level pseudo folder
                    relative_path = os.path.relpath(source_key, source_prefix)
                    if '/' in relative_path:
                        continue
                    
                    dest_key = os.path.join(dest_prefix, relative_path)
                    
                    if dry_run:
                        print(f"Would copy {source_key} to {dest_key}")
                    else:
                        print(f"Copying {source_key} to {dest_key}")
                        s3_client.copy_object(
                            CopySource={'Bucket': source_bucket, 'Key': source_key},
                            Bucket=dest_bucket,
                            Key=dest_key
                        )
        
        if dry_run:
            print("Dry run completed. No files were actually copied.")
        else:
            print("All files copied successfully.")
    except ClientError as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Copy S3 audio files from one location to another.')
    parser.add_argument('-s', '--source', type=str, default='public/audio/', help='Source prefix in S3 bucket')
    parser.add_argument('-d', '--destination', type=str, default='public/audio/treasures/', help='Destination prefix in S3 bucket')
    parser.add_argument('--dryrun', action='store_true', help='Perform a dry run without actually copying files')
    args = parser.parse_args()

    source_bucket = 'ananda-chatbot'
    dest_bucket = 'ananda-chatbot'
    
    try:
        s3_client = initialize_s3_client()
    except Exception as e:
        print(f"Error initializing S3 client: {e}")
        exit(1)

    copy_s3_files(s3_client, source_bucket, args.source, dest_bucket, args.destination, args.dryrun)