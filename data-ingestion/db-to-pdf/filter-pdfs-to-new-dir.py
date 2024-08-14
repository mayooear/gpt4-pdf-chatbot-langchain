import argparse
import os
import shutil
import PyPDF2
from tqdm import tqdm
from PyPDF2.errors import EmptyFileError

def duplicate_pdf_files(source_dir, dest_dir, authors):
    if not os.path.exists(dest_dir):
        proceed = input(f"Destination directory {dest_dir} does not exist. Do you want to create it? (y/n): ")
        if proceed.lower() == 'y':
            os.makedirs(dest_dir)
        else:
            print("Operation cancelled.")
            return
    elif os.listdir(dest_dir):
        proceed = input(f"Destination directory {dest_dir} is not empty. Do you want to proceed? (y/n): ")
        if proceed.lower() != 'y':
            print("Operation cancelled.")
            return

    author_mismatch_count = 0
    missing_author_count = 0

    for filename in tqdm(os.listdir(source_dir)):
        if filename.endswith(".pdf"):
            pdf_file_path = os.path.join(source_dir, filename)
            try:
                pdf_file_obj = open(pdf_file_path, 'rb')
                pdf_reader = PyPDF2.PdfReader(pdf_file_obj)
            except EmptyFileError:
                print(f"Warning: Ignored empty file {pdf_file_path}")
                continue
            metadata = pdf_reader.metadata
            author = metadata.get('/Author', None or '')

            if author:
                if any(name.lower() in author.lower() for name in authors):
                    shutil.copy(pdf_file_path, dest_dir)
                else:
                    author_mismatch_count += 1
            else:
                missing_author_count += 1
            pdf_file_obj.close()

    print(f"Total files filtered out due to author mismatch: {author_mismatch_count}")
    print(f"Total files filtered out due to missing author: {missing_author_count}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--source_dir", default="docs-test", help="Source directory containing PDF files")
    parser.add_argument("--dest_dir", default="docs-anandaLib-filtered", help="Destination directory to copy PDF files")
    parser.add_argument("--authors", required=True, help="Comma separated list of partial author names")
    args = parser.parse_args()
    authors = args.authors.split(',')
    duplicate_pdf_files(args.source_dir, args.dest_dir, authors)
