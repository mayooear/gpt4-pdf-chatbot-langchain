import os
import shutil
import requests
from fpdf import FPDF
import mysql.connector
from bs4 import BeautifulSoup
from mysql.connector import errors
import time

from requests import RequestException
from tqdm import tqdm

# Database configuration
db_config = {
    'user': 'michael',
    'password': 'ananda',
    'host': 'localhost',
    'database': 'anandalib',
    'charset': 'utf8mb4',  # Use utf8mb4 for full UTF-8 compatibility
    'collation': 'utf8mb4_unicode_ci',
}

base_url = "https://www.anandalibrary.org/content/"
unicode_font_path = '/System/Library/Fonts/Supplemental/Times New Roman.ttf'


# Function to establish a new database connection
def get_db_connection(db_config):
    try:
        return mysql.connector.connect(**db_config)
    except mysql.connector.Error as err:
        print(f"Error connecting to MySQL: {err}")
        return None


def remove_html_tags(text):
    return BeautifulSoup(text, 'html.parser').get_text()


def replace_smart_quotes(text):
    # Dictionary of smart quote characters to their standard ASCII equivalents
    smart_quotes = {
        u'\u2018': "'", u'\u2019': "'", u'\u201c': '"', u'\u201d': '"',
        u'\u2032': "'", u'\u2033': '"', u'\u2014': '-', u'\u2013': '-',
        u'\u2026': '...', u'\u2011': '-',
        u'\u00A0': ' ', u'\u00AB': '"', u'\u00BB': '"', u'\u201A': ',',
        u'\u201E': ',', u'\u2022': '*', u'\u2010': '-'
    }

    # Replace smart quotes with standard quotes
    for smart_quote, ascii_quote in smart_quotes.items():
        text = text.replace(smart_quote, ascii_quote)

    return text


def get_data_from_wp(post_id):
    api_url = f"https://staging2.anandalibrary.org/ananda-api/get-url/?post_id={post_id}"
    max_retries = 5
    retry_delay = 1  # start with 1 second delay

    for attempt in range(max_retries):
        try:
            response = requests.get(api_url)

            # Check if the request was successful
            if response.status_code == 200:
                data = response.json()
                # Replace 'staging2' with 'www' in the URL
                permalink = data["url"].replace('staging2.', 'www.')
                author_name = data["authors"][0] if data["authors"] else None
                return permalink, author_name
            else:
                print(
                    f"Attempt {attempt + 1}: Error retrieving data for post_id {post_id}. Status code: {response.status_code}")
                # If the response is a 504 Gateway Timeout, retry after a delay
                if response.status_code == 504:
                    time.sleep(retry_delay)
                    retry_delay *= 2  # Exponential backoff
                    continue
                else:
                    # For other errors, don't retry
                    break
        except RequestException as e:
            print(f"Attempt {attempt + 1}: Request failed: {e}")
            time.sleep(retry_delay)
            retry_delay *= 2  # Exponential backoff

    print(f"Failed to retrieve data for post_id {post_id} after {max_retries} attempts.")
    return None, None


# Copy the font to a writable directory
font_cache_dir = os.path.join(os.getcwd(), 'font_cache')
os.makedirs(font_cache_dir, exist_ok=True)
shutil.copy(unicode_font_path, font_cache_dir)  
unicode_font_path_cache = os.path.join(font_cache_dir, 'Times New Roman.ttf')

# Folder for PDF files
pdf_folder = "docs-anandaLib"
os.makedirs(pdf_folder, exist_ok=True)

max_retries = 5  # Set the maximum number of retries
attempt = 0

# Establish a new database connection
db = get_db_connection(db_config)
cursor = db.cursor(buffered=True)

# Query to count the total number of posts to be processed
count_query = """SELECT COUNT(*) FROM wp_posts 
                 WHERE post_status='publish' AND post_type='content'"""
cursor.execute(count_query)
total_posts = cursor.fetchone()[0]

# Query to select published posts
query = """
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
            LEFT JOIN wp_posts AS parent ON child.post_parent = parent.ID AND parent.post_type = 'content'
            LEFT JOIN wp_posts AS parent2 ON parent.post_parent = parent2.ID AND parent2.post_type = 'content'
            LEFT JOIN wp_posts AS parent3 ON parent2.post_parent = parent3.ID AND parent3.post_type = 'content'
        WHERE 
            child.post_status = 'publish' 
            AND child.post_type = 'content'
        ORDER BY 
            child.ID;
"""

# TODO: ChatGPT suggested this database retry logic below. Should rework this, so that the retry
# Happens just around the cursor iteration part. It would have to be restructured to not use a for loop.
while attempt < max_retries:
    try:
        # Execute the query
        cursor.execute(query)

        # Create PDF for each post
        n = 0
        skipped = 0
        progress_bar = tqdm(total=total_posts)
        for (id, content, post_name, parent_title_1, parent_title_2, parent_title_3, child_post_title) in cursor:
            # Sanitize post_name to ensure it is safe for use as a filename
            safe_post_name = "".join([c for c in post_name if c.isalpha() or c.isdigit() or c == ' ']).rstrip()

            file_name = os.path.join(pdf_folder, f"{safe_post_name}.pdf")

            # Check if the PDF already exists and is not zero bytes
            if os.path.isfile(file_name) and os.path.getsize(file_name) > 0:
                skipped += 1
                progress_bar.set_description(f"Skipped {skipped} - {safe_post_name}")
                progress_bar.update(1)
                continue

            # Filter out None values and concatenate parent titles with '::'.
            titles = [title for title in [parent_title_3, parent_title_2, parent_title_1, child_post_title] if title]

            # We insert a double colon here to be able to distinguish in the front end from a single 
            # colon and a tail. In case that is needed. We can remove the double colon in the front end display.
            post_title = ":: ".join(titles)

            print(f"{id}: {post_title}")
            
            # get permalink and author from WP
            permalink, author_name = get_data_from_wp(id)

            pdf = FPDF()
            pdf.add_page()
            pdf.add_font('TimesNewRoman', '', unicode_font_path_cache, uni=True)

            # Set permalink and author as PDF metadata
            post_title = replace_smart_quotes(post_title)
            if author_name is not None:
                author_name = replace_smart_quotes(author_name)
                pdf.set_author(author_name)
            pdf.set_title(post_title)
            pdf.set_subject(permalink)

            # Write post title and author name at the top of the PDF file
            pdf.set_font('TimesNewRoman', '', 7)
            pdf.multi_cell(0, 10, f"BY: {author_name}\nSOURCE: {permalink}\n\n")

            # Reset to larger font size for the title and content
            pdf.set_font('TimesNewRoman', '', 14)
            post_title = replace_smart_quotes(post_title)
            content = replace_smart_quotes(content)
            content = remove_html_tags(content)
            pdf.multi_cell(0, 10, f"{post_title}\n\n{content}")

            # Attempt to create the PDF file
            try:
                pdf.output(file_name, 'F')
            except IndexError:
                print(f"Failed to generate PDF for '{safe_post_name}': Character not supported")
                progress_bar.update(1)
            except Exception as e:  # Catching a broader exception for better fault tolerance
                print(f"Failed to generate PDF for '{safe_post_name}': {e}")
                raise
                # progress_bar.write(f"Failed to generate PDF for '{safe_post_name}': {e}")
            else:
                n += 1
                progress_bar.set_description(f"Processed {n} - {safe_post_name}")
                progress_bar.update(1)

        # Close the progress bar
        progress_bar.close()

        # Make sure to fetch all results if not already done so by the loop
        if cursor.with_rows:
            cursor.fetchall()

        # After processing all rows without an error, break out of the while loop
        break

    except mysql.connector.errors.OperationalError as e:
        print(f"Error: {e}. Retrying...")
        attempt += 1
        time.sleep(2 ** attempt) 

        # Properly close the current connection and cursor before retrying
        if cursor is not None and not cursor.closed:
            cursor.close()
        if db is not None and db.is_connected():
            db.close()

        # Attempt to re-establish the connection
        db = get_db_connection(db_config)
        if db is not None:
            cursor = db.cursor()
        else:
            print("Failed to re-establish the database connection.")
            break
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        if cursor.with_rows:
            cursor.fetchall()  # Fetch all results to ensure no unread results are left
        raise  # Reraise the exception to handle it accordingly

# Close the database connection
if db is not None and db.is_connected():
    cursor.close()
    db.close()

print(f"\n{n} PDF(s) created successfully, {skipped} skipped because they already exist.")
