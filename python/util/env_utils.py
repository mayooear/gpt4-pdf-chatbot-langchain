import os
from dotenv import load_dotenv
import argparse

def load_env(site_id):
    # Start from the current working directory
    current_dir = os.getcwd()
    
    # Look for the .env file in the current directory and up to three levels up
    for _ in range(4):
        env_path = os.path.join(current_dir, f'.env.{site_id}')
        if os.path.exists(env_path):
            load_dotenv(env_path)
            print(f"Loaded environment from: {env_path}")
            return dict(os.environ)
        current_dir = os.path.dirname(current_dir)
    
    raise FileNotFoundError(f"Environment file .env.{site_id} not found in the current directory or up to three levels up")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Load environment variables")
    parser.add_argument('--site', help='Site ID for environment variables')
    args = parser.parse_args()

    load_env(args.site)