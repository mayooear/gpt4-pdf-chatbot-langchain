#!/usr/bin/env python

import requests
import argparse
from requests.exceptions import ConnectionError, HTTPError, Timeout

def fetch_related_questions(update_batch):
    url = f"http://localhost:3000/api/relatedQuestions?updateBatch={update_batch}"
    try:
        response = requests.get(url)
        response.raise_for_status()  # Raise an error for bad status codes
        data = response.json()
        print(data.get("message", "No message found in response"))
    except ConnectionError:
        print("Error: Unable to connect to the server. Please ensure the server is running and accessible.")
    except HTTPError as http_err:
        print(f"HTTP error occurred: {http_err}")
    except Timeout:
        print("Error: The request timed out. Please try again later.")
    except requests.exceptions.RequestException as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch related questions.")
    parser.add_argument(
        "update_batch",
        type=int,
        nargs="?",
        default=40,
        help="The batch number to update (default: 40)"
    )
    args = parser.parse_args()
    fetch_related_questions(args.update_batch)