#!/usr/bin/env python3
"""
Flatten Directory Structure

This script flattens a directory structure by moving all files from subdirectories
to the top-level directory specified as a command-line argument. It performs the
following actions:

1. Moves all files from subdirectories to the top-level directory.
2. Skips and reports any file conflicts (files with the same name in the destination).
3. Removes empty directories after moving files.
4. Logs all actions and provides a summary of conflicts, if any.

Usage:
    python flatten_directory.py /path/to/top/level/directory

Note: This script modifies the directory structure. Use with caution.
"""

import os
import sys
import shutil
import argparse
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def flatten_directory(top_dir):
    """Recursively flatten the directory structure."""
    conflicts = []
    for root, dirs, files in os.walk(top_dir, topdown=False):
        for file in files:
            source_path = os.path.join(root, file)
            if root != top_dir:
                dest_path = os.path.join(top_dir, file)
                if os.path.exists(dest_path):
                    conflicts.append((source_path, dest_path))
                    logger.warning(f"Conflict: {source_path} -> {dest_path}")
                else:
                    try:
                        shutil.move(source_path, dest_path)
                        logger.info(f"Moved: {source_path} -> {dest_path}")
                    except Exception as e:
                        logger.error(f"Error moving file {source_path}: {e}")

    # Remove empty directories
    for root, dirs, files in os.walk(top_dir, topdown=False):
        for dir in dirs:
            try:
                dir_path = os.path.join(root, dir)
                if not os.listdir(dir_path):
                    os.rmdir(dir_path)
                    logger.info(f"Removed empty directory: {dir_path}")
            except Exception as e:
                logger.error(f"Error removing directory {dir_path}: {e}")

    return conflicts

def confirm_action():
    """Ask for user confirmation before proceeding."""
    response = input("Are you sure you want to flatten the directory? This action cannot be undone. (y/n): ").lower().strip()
    return response == 'y' or response == 'yes'

def main():
    parser = argparse.ArgumentParser(description="Flatten a directory structure.")
    parser.add_argument("top_dir", help="Path to the top-level directory to flatten")
    args = parser.parse_args()

    top_dir = os.path.abspath(args.top_dir)
    
    if not os.path.isdir(top_dir):
        logger.error(f"The specified path is not a directory: {top_dir}")
        sys.exit(1)

    logger.info(f"Preparing to flatten directory: {top_dir}")
    
    if not confirm_action():
        logger.info("Operation cancelled by user.")
        sys.exit(0)

    logger.info(f"Flattening directory: {top_dir}")
    conflicts = flatten_directory(top_dir)
    logger.info("Directory flattening complete.")

    if conflicts:
        logger.warning("The following conflicts were encountered:")
        for source, dest in conflicts:
            logger.warning(f"  {source} -> {dest}")
        logger.warning(f"Total conflicts: {len(conflicts)}")
    else:
        logger.info("No conflicts were encountered.")

if __name__ == "__main__":
    main()