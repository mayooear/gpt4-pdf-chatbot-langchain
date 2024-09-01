#!/usr/bin/env python3

import os
import shutil
import traceback
import requests
from fpdf import FPDF
import pymysql
from bs4 import BeautifulSoup
import time
import sys
from requests import RequestException
from tqdm import tqdm
import warnings
from util.env_utils import load_env
import argparse
from PyPDF2 import PdfReader, PdfWriter
from PyPDF2.generic import TextStringObject
import logging
from PyPDF2.errors import PdfReadError

# Suppress specific warning from fpdf
warnings.filterwarnings("ignore", message="cmap value too big/small")


def parse_arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", required=True, help="Site name (ananda or jairam)")
    parser.add_argument("--database", required=True, help="Database name")
    parser.add_argument(
        "--attachments", action="store_true", help="Download PDF attachments"
    )
    return parser.parse_args()


def get_config(site):
    config = {
        "ananda": {
            "base_url": "https://www.anandalibrary.org/content/",
            "post_types": ["content"],
            "use_api": True,
        },
        "jairam": {
            "base_url": "https://freejoehunt.com/",
            "post_types": ["page", "post"],
            "use_api": False,
        },
    }
    return config[site]


def get_db_config(args):
    return {
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "host": os.getenv("DB_HOST"),
        "database": args.database,
        "charset": os.getenv("DB_CHARSET"),
        "collation": os.getenv("DB_COLLATION"),
    }


def get_db_connection(db_config):
    try:
        return pymysql.connect(**db_config)
    except pymysql.MySQLError as err:
        print(f"Error connecting to MySQL: {err}")
        return None


def remove_html_tags(text):
    return BeautifulSoup(text, "html.parser").get_text()


def replace_smart_quotes(text):
    # Dictionary of smart quote characters to their standard ASCII equivalents
    smart_quotes = {
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u2032": "'",
        "\u2033": '"',
        "\u2014": "-",
        "\u2013": "-",
        "\u2026": "...",
        "\u2011": "-",
        "\u00A0": " ",
        "\u00AB": '"',
        "\u00BB": '"',
        "\u201A": ",",
        "\u201E": ",",
        "\u2022": "*",
        "\u2010": "-",
    }

    # Replace smart quotes with standard quotes
    for smart_quote, ascii_quote in smart_quotes.items():
        text = text.replace(smart_quote, ascii_quote)

    return text


def get_data_from_wp(post_id, db, cursor):
    # Check if permalink and author_name are already in the database
    cursor.execute(
        "SELECT permalink, author_name FROM wp_posts WHERE ID = %s", (post_id,)
    )
    result = cursor.fetchone()
    if result and result[0] and result[1]:
        return result[0], result[1]

    # If not in DB, proceed with HTTP request
    api_url = os.getenv("GET_URL_API") + str(post_id)
    max_retries = 5
    retry_delay = 1  # start with 1 second delay

    for attempt in range(max_retries):
        try:
            response = requests.get(api_url)
            if response.status_code == 200:
                data = response.json()
                if "url" in data:
                    permalink = data["url"]
                else:
                    print(f"URL not found in response for post_id {post_id}")
                    permalink = ""

                author_name = data["authors"][0] if data.get("authors") else None

                # Store permalink and author_name in the database for future use
                cursor.execute(
                    "UPDATE wp_posts SET permalink = %s, author_name = %s WHERE ID = %s",
                    (permalink, author_name, post_id),
                )
                db.commit()
                return permalink, author_name

            else:
                print(
                    f"Attempt {attempt + 1}: Error retrieving data for post_id {post_id}. Status code: {response.status_code}"
                )
                if response.status_code == 504:
                    time.sleep(retry_delay)
                    retry_delay *= 2
                    continue
                else:
                    break

        except RequestException as e:
            print(f"Attempt {attempt + 1}: Request failed: {e}")
            time.sleep(retry_delay)
            retry_delay *= 2
        except pymysql.MySQLError as e:
            print(f"MySQL Error encountered: {e}")
            sys.exit(1)

    print(
        f"Failed to retrieve data for post_id {post_id} after {max_retries} attempts."
    )
    return None, None


def get_pdf_attachments(cursor):
    query = f"""
    SELECT 
        p.ID,
        p.post_title,
        p.post_date,
        pm.meta_value AS file_path
    FROM 
        wp_posts p
    JOIN 
        wp_postmeta pm ON p.ID = pm.post_id
    WHERE 
        p.post_type = 'attachment'
        AND p.post_mime_type = 'application/pdf'
        AND pm.meta_key = '_wp_attached_file';
    """
    cursor.execute(query)
    return cursor.fetchall()


def download_pdf(url, output_path):
    response = requests.get(url)
    if response.status_code == 200:
        with open(output_path, "wb") as f:
            f.write(response.content)
        return True
    return False


def setup_environment(args):
    load_env(args.site)
    site_config = get_config(args.site)
    db_config = get_db_config(args)
    unicode_font_path_cache = setup_font_cache()
    pdf_folder = setup_pdf_folder(args.site)
    return site_config, db_config, pdf_folder, unicode_font_path_cache


def setup_font_cache():
    unicode_font_path = "/System/Library/Fonts/Supplemental/Times New Roman.ttf"

    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Create a font_cache directory in the script's directory
    font_cache_dir = os.path.join(script_dir, "font_cache")
    os.makedirs(font_cache_dir, exist_ok=True)
    
    destination_path = os.path.join(font_cache_dir, "Times New Roman.ttf")
    
    if not os.path.exists(destination_path):
        shutil.copy(unicode_font_path, destination_path)
    
    print(f"Font cache path: {destination_path}")
    return destination_path


def setup_pdf_folder(site):
    pdf_folder = f"docs-{site}"
    os.makedirs(pdf_folder, exist_ok=True)
    return pdf_folder


def get_total_posts_count(cursor, post_types):
    count_query = f"""SELECT COUNT(*) FROM wp_posts 
                     WHERE post_status='publish' AND post_type IN ({','.join(['%s']*len(post_types))})"""
    cursor.execute(count_query, post_types)
    return cursor.fetchone()[0]


def process_posts_api_version(cursor, post_types, total_posts, pdf_folder, unicode_font_path_cache, db):
    """
    Process posts using an API call to retrieve additional information.
    This version is used when the full WordPress database is not available.
    It makes individual API calls to get the permalink and author information for each post.
    """
    query = f"""
        SELECT 
            child.ID, 
            child.post_content, 
            child.post_name,
            parent.post_title AS PARENT_TITLE_1,
            parent2.post_title AS PARENT_TITLE_2,
            parent3.post_title AS PARENT_TITLE_3,
            child.post_title AS CHILD_TITLE
        FROM 
            wp_posts AS child
            LEFT JOIN wp_posts AS parent ON child.post_parent = parent.ID AND parent.post_type IN ({','.join(['%s']*len(post_types))})
            LEFT JOIN wp_posts AS parent2 ON parent.post_parent = parent2.ID AND parent2.post_type IN ({','.join(['%s']*len(post_types))})
            LEFT JOIN wp_posts AS parent3 ON parent2.post_parent = parent3.ID AND parent3.post_type IN ({','.join(['%s']*len(post_types))})
        WHERE 
            child.post_status = 'publish' 
            AND child.post_type IN ({','.join(['%s']*len(post_types))})
        ORDER BY 
            child.ID;
    """
    # Execute the query with parameters. We multiply post_types by 4 because
    # the query uses the post_types list four times (for child, parent, parent2, and parent3).
    # This ensures we have enough parameters to fill all placeholders in the query.
    cursor.execute(query, post_types * 4)

    n = 0
    skipped = 0
    progress_bar = tqdm(total=total_posts)
    rows = cursor.fetchall()
    for row in rows:
        if row is None:
            continue

        (
            id,
            content,
            post_name,
            parent_title_1,
            parent_title_2,
            parent_title_3,
            child_post_title,
        ) = row
        # Sanitize post_name to ensure it is safe for use as a filename
        safe_post_name = "-".join(
            "".join(c if c.isalnum() or c.isspace() else " " for c in post_name).split()
        ).lower()
        file_name = os.path.join(pdf_folder, f"{safe_post_name}.pdf")

        if os.path.isfile(file_name) and os.path.getsize(file_name) > 0:
            skipped += 1
            progress_bar.set_description(f"Skipped {skipped} - {child_post_title}")
            progress_bar.update(1)
            continue

        # Filter out None values and concatenate parent titles with '::'.
        titles = [
            title
            for title in [
                parent_title_3,
                parent_title_2,
                parent_title_1,
                child_post_title,
            ]
            if title
        ]

        # We insert a double colon here to be able to distinguish in the front end from a single
        # colon and a tail. In case that is needed. We can remove the double colon in the front end display.
        post_title = ":: ".join(titles)

        if any("DO NOT USE" in title for title in titles):
            print(f"Skipping 'do not use' title: {id}: {post_title}")
            skipped += 1
            progress_bar.set_description(f"Skipped {skipped} - {child_post_title}")
            progress_bar.update(1)
            continue

        permalink, author_name = get_data_from_wp(id, db, cursor)

        pdf = create_pdf(
            post_title, author_name, permalink, content, unicode_font_path_cache
        )

        try:
            pdf.output(file_name, "F")
        except IndexError:
            print(
                f"Failed to generate PDF for '{safe_post_name}': Character not supported"
            )
            progress_bar.update(1)
        except Exception as e:
            print(f"Failed to generate PDF for '{safe_post_name}': {e}")
            raise
        else:
            n += 1
            progress_bar.set_description(f"Processed {n} - {child_post_title}")
            progress_bar.update(1)

    progress_bar.close()
    return n, skipped


def process_posts_full_db_version(cursor, post_types, total_posts, pdf_folder, unicode_font_path_cache, db, base_url):
    """
    Process posts using only the database, without making API calls.
    This version is used when the full WordPress database dump is available.
    It retrieves all necessary information, including permalinks and author names,
    directly from the database in a single query.
    """
    query = f"""
        SELECT 
            child.ID, 
            child.post_content, 
            child.post_name,
            parent.post_title AS PARENT_TITLE_1,
            parent2.post_title AS PARENT_TITLE_2,
            parent3.post_title AS PARENT_TITLE_3,
            child.post_title AS CHILD_TITLE,
            child.post_author,
            child.post_date,
            child.post_type,
            CONCAT('{base_url}', 
                   CASE 
                     WHEN child.post_type = 'page' THEN ''
                     ELSE CONCAT(YEAR(child.post_date), '/',
                                 LPAD(MONTH(child.post_date), 2, '0'), '/')
                   END,
                   child.post_name, '/') AS permalink
        FROM 
            wp_posts AS child
            LEFT JOIN wp_posts AS parent ON child.post_parent = parent.ID AND parent.post_type IN ({','.join(['%s']*len(post_types))})
            LEFT JOIN wp_posts AS parent2 ON parent.post_parent = parent2.ID AND parent2.post_type IN ({','.join(['%s']*len(post_types))})
            LEFT JOIN wp_posts AS parent3 ON parent2.post_parent = parent3.ID AND parent3.post_type IN ({','.join(['%s']*len(post_types))})
        WHERE 
            child.post_status = 'publish' 
            AND child.post_type IN ({','.join(['%s']*len(post_types))})
        ORDER BY 
            child.ID;
    """
    cursor.execute(query, post_types * 4)

    n = 0
    skipped = 0
    progress_bar = tqdm(total=total_posts)
    rows = cursor.fetchall()
    for row in rows:
        if row is None:
            continue

        (id, content, post_name, parent_title_1, parent_title_2, parent_title_3, 
         child_post_title, post_author, post_date, post_type, permalink) = row
        
        # Sanitize post_name to ensure it is safe for use as a filename
        safe_post_name = "-".join(
            "".join(c if c.isalnum() or c.isspace() else " " for c in post_name).split()
        ).lower()
        file_name = os.path.join(pdf_folder, f"{safe_post_name}.pdf")

        if os.path.isfile(file_name) and os.path.getsize(file_name) > 0:
            skipped += 1
            progress_bar.set_description(f"Skipped {skipped} - {child_post_title}")
            progress_bar.update(1)
            continue

        # Filter out None values and concatenate parent titles with '::'.
        titles = [
            title
            for title in [
                parent_title_3,
                parent_title_2,
                parent_title_1,
                child_post_title,
            ]
            if title
        ]

        # We insert a double colon here to be able to distinguish in the front end from a single
        # colon and a tail. In case that is needed. We can remove the double colon in the front end display.
        post_title = ":: ".join(titles)

        if any("DO NOT USE" in title for title in titles):
            print(f"Skipping 'do not use' title: {id}: {post_title}")
            skipped += 1
            progress_bar.set_description(f"Skipped {skipped} - {child_post_title}")
            progress_bar.update(1)
            continue

        # Get author name
        cursor.execute("SELECT display_name FROM wp_users WHERE ID = %s", (post_author,))
        author_result = cursor.fetchone()
        author_name = author_result[0] if author_result else None

        pdf = create_pdf(
            post_title, author_name, permalink, content, unicode_font_path_cache
        )

        try:
            pdf.output(file_name, "F")
        except IndexError:
            print(
                f"Failed to generate PDF for '{safe_post_name}': Character not supported"
            )
            progress_bar.update(1)
        except Exception as e:
            print(f"Failed to generate PDF for '{safe_post_name}': {e}")
            raise
        else:
            n += 1
            progress_bar.set_description(f"Processed {n} - {child_post_title}")
            progress_bar.update(1)

    progress_bar.close()
    return n, skipped


def process_posts(cursor, post_types, total_posts, pdf_folder, unicode_font_path_cache, db, site_config):
    if site_config.get('use_api', False):
        return process_posts_api_version(cursor, post_types, total_posts, pdf_folder, unicode_font_path_cache, db)
    else:
        return process_posts_full_db_version(cursor, post_types, total_posts, pdf_folder, unicode_font_path_cache, db, site_config['base_url'])


def create_pdf(post_title, author_name, permalink, content, unicode_font_path_cache):
    pdf = FPDF()
    pdf.add_page()
    
    # Commented out custom font code
    # # Check if the font file exists
    # if not os.path.exists(unicode_font_path_cache):
    #     print(f"Font file not found: {unicode_font_path_cache}")
    #     # Use a default font if the custom font is not available
    #     pdf.set_font("Arial", "", 14)
    # else:
    #     # Force FPDF to use the new path
    #     pdf.add_font("TimesNewRoman", "", unicode_font_path_cache, uni=True)
    #     pdf.set_font("TimesNewRoman", "", 14)

    # Try to use a Unicode-compatible font that's likely to be on macOS
    try:
        pdf.add_font("Arial Unicode MS", "", "/Library/Fonts/Arial Unicode.ttf", uni=True)
        font_name = "Arial Unicode MS"
    except FileNotFoundError:
        print("Arial Unicode MS font not found. Falling back to built-in font.")
        font_name = "Helvetica"
    
    pdf.set_font(font_name, "", 14)

    post_title = replace_smart_quotes(post_title)
    if author_name is not None:
        author_name = replace_smart_quotes(author_name)
        pdf.set_author(author_name)
    pdf.set_title(post_title)
    pdf.set_subject(permalink)

    # Write post title and author name at the top of the PDF file.
    # Note important to keep font size VERY small as the URL needs to display on a single line
    # in a PDF reader or it won't read in properly during ingestion.
    # Some URLs can be upwards of 283 characters.
    # 7/1/24 mvo: We no longer use SOURCE: Contact from the PDF file during ingestion. Once we are certain
    # that the Subject metadata contains the correct URL, we can remove writing the source permalink below

    pdf.set_font(font_name, "", 4)
    pdf.multi_cell(0, 10, f"BY: {author_name}\nSOURCE: {permalink}\n\n")

    pdf.set_font(font_name, "", 14)
    content = replace_smart_quotes(content)
    content = remove_html_tags(content)
    pdf.multi_cell(0, 10, f"{post_title}\n\n{content}")

    return pdf


def process_attachments(cursor, base_url, pdf_folder):
    attachments = get_pdf_attachments(cursor)
    print(f"\nProcessing {len(attachments)} PDF attachments...")
    processed_count = 0
    skipped_count = 0
    error_count = 0

    # Create attachments subdirectory
    attachments_folder = os.path.join(pdf_folder, "attachments")
    os.makedirs(attachments_folder, exist_ok=True)

    for attachment in tqdm(attachments):
        id, title, date, file_path = attachment

        # Construct the full URL to the attachment
        attachment_url = f"{base_url}wp-content/uploads/{file_path}"

        safe_title = "-".join(
            "".join(c if c.isalnum() or c.isspace() else " " for c in title).split()
        ).lower()
        new_filename = f"{date.strftime('%Y-%m-%d')}_{safe_title}_{id}.pdf"
        new_path = os.path.join(attachments_folder, new_filename)

        if os.path.exists(new_path):
            skipped_count += 1
            tqdm.write(f"Skipped (already exists): {new_filename}")
            continue

        try:
            if download_pdf(attachment_url, new_path):
                logging.info(f"Downloaded: {new_filename}")
                set_pdf_metadata(
                    new_path, title, None, attachment_url
                )
                logging.info(f"Set metadata for: {new_filename}")
                tqdm.write(f"Downloaded and processed: {new_filename}")
                processed_count += 1
            else:
                logging.error(f"Failed to download: {attachment_url}")
                print(f"Failed to download: {attachment_url}")
                error_count += 1
        except Exception as e:
            error_msg = f"Error processing attachment {id}: {str(e)}\n{traceback.format_exc()}"
            logging.error(error_msg)
            print(error_msg)
            error_count += 1
            if os.path.exists(new_path):
                os.remove(new_path)

    print(f"\nProcessed: {processed_count}, Skipped: {skipped_count}, Errors: {error_count}, Total: {len(attachments)}")
    return processed_count


def set_pdf_metadata(file_path, title, author, subject):
    try:
        with open(file_path, "rb") as file:
            reader = PdfReader(file)
            writer = PdfWriter()

            for page in reader.pages:
                writer.add_page(page)

            def safe_text_string(value):
                if value is None:
                    return TextStringObject("")
                try:
                    return TextStringObject(str(value))
                except Exception as e:
                    logging.warning(f"Error creating TextStringObject for '{value}': {str(e)}")
                    return TextStringObject("")

            metadata = {
                "/Title": safe_text_string(title),
                "/Author": safe_text_string(author or "Unknown"),
                "/Subject": safe_text_string(subject)
            }

            writer.add_metadata(metadata)

            with open(file_path, "wb") as output_file:
                writer.write(output_file)
    except PdfReadError as e:
        logging.error(f"Error reading PDF {file_path}: {str(e)}")
    except Exception as e:
        logging.error(f"Unexpected error processing PDF {file_path}: {str(e)}")


def handle_mysql_error(e, attempt):
    print(f"Error: {e}. Retrying...")
    time.sleep(2**attempt)


def handle_unexpected_error(e):
    print(f"An unexpected error occurred: {e}")


def close_db_connection(db, cursor):
    if cursor is not None:
        cursor.close()
    if db is not None and db.open:
        db.close()


def print_summary(n, skipped, attachments_processed):
    print(
        f"\n{n} PDF(s) created successfully, {skipped} skipped because they already exist."
    )
    if attachments_processed:
        print(f"{attachments_processed} PDF attachments processed.")


def main():
    args = parse_arguments()
    site_config, db_config, pdf_folder, unicode_font_path_cache = setup_environment(
        args
    )
    print(f"Unicode font path cache: {unicode_font_path_cache}")

    max_retries = 5
    attempt = 0

    # Configure logging
    logging.basicConfig(level=logging.WARNING, format='%(asctime)s - %(levelname)s - %(message)s')

    while attempt < max_retries:
        try:
            db = get_db_connection(db_config)
            if db is None:
                raise pymysql.MySQLError("Failed to connect to the database")
            
            cursor = db.cursor() 

            total_posts = get_total_posts_count(cursor, site_config["post_types"])

            n, skipped = process_posts(
                cursor,
                site_config["post_types"],
                total_posts,
                pdf_folder,
                unicode_font_path_cache,
                db,
                site_config
            )

            attachments_processed = 0
            if args.attachments:
                attachments_processed = process_attachments(
                    cursor, site_config["base_url"], pdf_folder
                )

            print_summary(n, skipped, attachments_processed)
            break
        except pymysql.MySQLError as e:
            handle_mysql_error(e, attempt)
            attempt += 1
        except Exception as e:
            handle_unexpected_error(e)
            raise
        finally:
            if 'db' in locals() and db is not None:
                close_db_connection(db, cursor if 'cursor' in locals() else None)

    if attempt == max_retries:
        print("Max retries reached. Exiting.")


if __name__ == "__main__":
    main()
