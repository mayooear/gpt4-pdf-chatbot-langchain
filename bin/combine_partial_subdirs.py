#!/usr/bin/env python3
"""
Combine Folder Hierarchies

This script combines partial folder hierarchies into a single, unified hierarchy.
This is helpful, for instance, after downloading from Google Drive multiple zip 
files that each are a partial representation of a single hierarchy of content files.

It performs the following actions:

1. Recreates the folder structure in the output directory.
2. Copies all files from input subdirectories to the corresponding output directories.
3. Handles file conflicts by appending a number to duplicate filenames.
4. Logs all actions and provides a summary of operations.

Usage:
    python combine_hierarchies.py /path/to/input/directory --output output_dirname

Note: This script creates a new directory structure. Use with caution.
"""

import os
import sys
import shutil
import argparse
import logging
from tqdm import tqdm

logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def combine_hierarchies(input_dir, output_dir):
    """Recursively combine the directory structures, skipping the first level."""
    file_count = 0
    dir_count = 0
    warning_count = 0
    error_count = 0
    warning_files = []
    error_files = []

    # Count total files and directories, excluding the top level
    total_items = sum([len(files) + len(dirs) for root, dirs, files in os.walk(input_dir) if root != input_dir])

    with tqdm(total=total_items, desc="Combining hierarchies", unit="item") as pbar:
        for top_dir in os.listdir(input_dir):
            top_dir_path = os.path.join(input_dir, top_dir)
            if not os.path.isdir(top_dir_path):
                continue

            for root, dirs, files in os.walk(top_dir_path):
                rel_path = os.path.relpath(root, top_dir_path)
                target_dir = os.path.join(output_dir, rel_path)

                if not os.path.exists(target_dir):
                    os.makedirs(target_dir)
                    dir_count += 1
                    pbar.update(1)

                for file in files:
                    source_path = os.path.join(root, file)
                    dest_path = os.path.join(target_dir, file)
                    
                    if os.path.exists(dest_path):
                        base, ext = os.path.splitext(file)
                        counter = 1
                        while os.path.exists(dest_path):
                            new_file = f"{base}_{counter}{ext}"
                            dest_path = os.path.join(target_dir, new_file)
                            counter += 1
                        logger.warning(f"Renamed duplicate file: {file} -> {os.path.basename(dest_path)}")
                        warning_count += 1
                        warning_files.append(f"{file} (renamed to {os.path.basename(dest_path)})")

                    try:
                        shutil.copy2(source_path, dest_path)
                        file_count += 1
                        pbar.update(1)
                    except Exception as e:
                        logger.error(f"Error copying file {source_path}: {e}")
                        error_count += 1
                        error_files.append(source_path)

    return file_count, dir_count, warning_count, error_count, warning_files, error_files

def confirm_action():
    """Ask for user confirmation before proceeding."""
    response = input("Are you sure you want to combine the hierarchies? This will create a new directory structure. (y/n): ").lower().strip()
    return response == 'y' or response == 'yes'

def main():
    parser = argparse.ArgumentParser(description="Combine partial folder hierarchies into a single, unified hierarchy.")
    parser.add_argument("input_dir", help="Path to the input directory containing partial hierarchies")
    parser.add_argument("-o", "--output", default="--output", help="Name of the output directory (default: --output)")
    args = parser.parse_args()

    input_dir = os.path.abspath(args.input_dir)
    output_dir = os.path.abspath(os.path.join(os.path.dirname(input_dir), args.output))
    
    if not os.path.isdir(input_dir):
        logger.error(f"The specified input path is not a directory: {input_dir}")
        sys.exit(1)

    print(f"Preparing to combine hierarchies from: {input_dir}")
    print(f"Output directory will be: {output_dir}")
    
    if not confirm_action():
        print("Operation cancelled by user.")
        sys.exit(0)

    if os.path.exists(output_dir):
        logger.error(f"Output directory already exists: {output_dir}")
        sys.exit(1)

    file_count, dir_count, warning_count, error_count, warning_files, error_files = combine_hierarchies(input_dir, output_dir)
    print("Hierarchy combination complete.")
    print(f"Created {dir_count} directories and copied {file_count} files.")
    print(f"Encountered {warning_count} warnings and {error_count} errors.")
    
    if warning_files:
        print("\nFiles with warnings:")
        for file in warning_files:
            print(f"- {file}")
    
    if error_files:
        print("\nFiles that failed to copy:")
        for file in error_files:
            print(f"- {file}")

if __name__ == "__main__":
    main()