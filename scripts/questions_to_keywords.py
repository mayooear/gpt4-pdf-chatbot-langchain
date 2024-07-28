#!/usr/bin/env python

from google.cloud import firestore
from google.oauth2 import service_account
from sklearn.feature_extraction.text import TfidfVectorizer
from rake_nltk import Rake
import os
from dotenv import load_dotenv
import argparse
import json
import nltk

# Load environment variables from .env file
load_dotenv('../.env')

def initialize_firestore(env_prefix):
    # Load the service account credentials from the JSON string
    credentials_json = os.getenv("FIREBASE_ADMINSDK_JSON")
    if not credentials_json:
        raise ValueError("FIREBASE_ADMINSDK_JSON environment variable is not set or is empty")

    try:
        credentials_dict = json.loads(credentials_json)
        credentials = service_account.Credentials.from_service_account_info(credentials_dict)
    except json.JSONDecodeError as e:
        raise ValueError(f"Error decoding JSON from FIREBASE_ADMINSDK_JSON: {e}")

    if env_prefix == 'dev':
        firestore_emulator_host = os.getenv("FIRESTORE_EMULATOR_HOST")
        if firestore_emulator_host:
            os.environ["FIRESTORE_EMULATOR_HOST"] = firestore_emulator_host
    else:
        # Unset FIRESTORE_EMULATOR_HOST for production
        if "FIRESTORE_EMULATOR_HOST" in os.environ:
            del os.environ["FIRESTORE_EMULATOR_HOST"]

    try:
        return firestore.Client(credentials=credentials)
    except Exception as e:
        raise RuntimeError(f"Error initializing Firestore: {e}")

# Ensure NLTK stopwords are downloaded
nltk.download('stopwords')

def fetch_questions(db, env_prefix):
    questions = []
    collection_name = f"{env_prefix}_chatLogs"
    docs = db.collection(collection_name).stream()
    for doc in docs:
        data = doc.to_dict()
        if 'question' in data:
            questions.append(data['question'])
    return questions

def extract_keywords(questions):
    if not questions:
        raise ValueError("No questions found in the specified environment.")

    # TF-IDF for single words
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        X = vectorizer.fit_transform(questions)
    except ValueError as e:
        raise ValueError("Error in TF-IDF vectorization: " + str(e))

    feature_names = vectorizer.get_feature_names_out()
    tfidf_keywords = [set() for _ in range(len(questions))]
    for row, col in zip(*X.nonzero()):
        tfidf_keywords[row].add(feature_names[col])

    # RAKE for multi-word phrases
    rake = Rake()
    rake_keywords = []
    for question in questions:
        rake.extract_keywords_from_text(question)
        rake_keywords.append(set(rake.get_ranked_phrases()))

    # Combine and deduplicate keywords
    combined_keywords = [tfidf.union(rake) for tfidf, rake in zip(tfidf_keywords, rake_keywords)]
    return combined_keywords

def jaccard_similarity(set1, set2):
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    return intersection / union

def find_related_questions(given_question, all_questions, all_keywords, threshold=0.1):
    given_keywords = extract_keywords([given_question])[0]
    similarity_scores = []

    for i, keywords in enumerate(all_keywords):
        score = jaccard_similarity(given_keywords, keywords)
        if score >= threshold:
            similarity_scores.append((score, all_questions[i]))

    # Sort questions by similarity score in descending order
    similarity_scores.sort(reverse=True, key=lambda x: x[0])
    return similarity_scores

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract keywords from Firestore questions and find related questions.')
    parser.add_argument('-e', '--env', type=str, choices=['dev', 'prod'], required=True, help='Environment (dev or prod)')
    parser.add_argument('-q', '--question', type=str, help='Question to find related questions for')
    parser.add_argument('-t', '--threshold', type=float, default=0.1, help='Threshold for similarity score')
    args = parser.parse_args()

    env_prefix = args.env
    try:
        db = initialize_firestore(env_prefix)
    except Exception as e:
        print(f"Error initializing Firestore: {e}")
        exit(1)

    questions = fetch_questions(db, env_prefix)
    if not questions:
        print(f"No questions found for environment: {env_prefix}")
    else:
        try:
            all_keywords = extract_keywords(questions)
            if args.question:
                related_questions = find_related_questions(args.question, questions, all_keywords, args.threshold)
                print(f"Related questions to '{args.question}':")
                for score, question in related_questions:
                    print(f"Score: {score:.2f}, Question: {question}")
            else:
                keywords = extract_keywords(questions)
                print("Extracted Keywords:", keywords)
        except ValueError as e:
            print("Error during keyword extraction:", e)