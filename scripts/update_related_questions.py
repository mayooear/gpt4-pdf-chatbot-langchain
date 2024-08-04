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
from tqdm import tqdm

# Determine the directory of the script
script_dir = os.path.dirname(os.path.abspath(__file__))
env_path = os.path.join(script_dir, '../.env')

# Load environment variables from .env file
load_dotenv(env_path)

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

    # if env_prefix == 'dev':
    #     firestore_emulator_host = os.getenv("FIRESTORE_EMULATOR_HOST")
    #     if firestore_emulator_host:
    #         os.environ["FIRESTORE_EMULATOR_HOST"] = firestore_emulator_host
    # else:
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
    doc_count = 0  # Add a counter to track the number of documents
    for doc in docs:
        doc_count += 1
        data = doc.to_dict()
        questions.append({'id': doc.id, 'question': data['question']})
    print(f"Fetched {doc_count} documents from {collection_name}")  # Debugging statement
    return questions

def fetch_question_by_id(db, env_prefix, question_id):
    doc = db.collection(f"{env_prefix}_chatLogs").document(question_id).get()
    if not doc.exists:
        raise ValueError(f"Question with ID {question_id} not found.")
    return doc.to_dict()

def extract_keywords(questions):
    if not questions:
        raise ValueError("No questions found in the specified environment.")

    question_texts = [q['question'] for q in questions]

    if not any(question_texts):
        raise ValueError("All questions are empty or contain only stop words.")

    # TF-IDF for single words
    vectorizer = TfidfVectorizer(stop_words='english')
    try:
        X = vectorizer.fit_transform(question_texts)
    except ValueError as e:
        if e != "empty vocabulary; perhaps the documents only contain stop words":
            print("Warning: Error in TF-IDF vectorization. This might be due to empty vocabulary or documents containing only stop words.")
            print("Error details:", e)
        return [set() for _ in range(len(question_texts))]

    feature_names = vectorizer.get_feature_names_out()
    tfidf_keywords = [set() for _ in range(len(question_texts))]
    for row, col in zip(*X.nonzero()):
        tfidf_keywords[row].add(feature_names[col])

    # RAKE for multi-word phrases
    rake = Rake()
    rake_keywords = []
    for question in question_texts:
        rake.extract_keywords_from_text(question)
        rake_keywords.append(set(rake.get_ranked_phrases()))

    # Combine and deduplicate keywords
    combined_keywords = [tfidf.union(rake) for tfidf, rake in zip(tfidf_keywords, rake_keywords)]
    return combined_keywords

def jaccard_similarity(set1, set2):
    intersection = len(set1.intersection(set2))
    union = len(set1.union(set2))
    if union == 0:
        return 0  # Return 0 similarity if both sets are empty
    return intersection / union

def find_related_questions(given_question_text, all_questions, all_keywords, threshold=0.1, exclude_question_id=None):
    given_keywords = extract_keywords([{'id': None, 'question': given_question_text}])[0]
    similarity_scores = []

    for i, keywords in enumerate(all_keywords):
        if all_questions[i]['id'] == exclude_question_id:
            continue
        if all_questions[i]['question'] == given_question_text:
            continue
        score = jaccard_similarity(given_keywords, keywords)
        if score >= threshold:
            similarity_scores.append((score, all_questions[i]))

    # Sort questions by similarity score in descending order
    similarity_scores.sort(reverse=True, key=lambda x: x[0])

    # Filter out duplicates, keeping only the highest score for each unique question text
    unique_questions = {}
    for score, question in similarity_scores:
        if question['question'] not in unique_questions:
            unique_questions[question['question']] = (score, question)
        else:
            if score > unique_questions[question['question']][0]:
                unique_questions[question['question']] = (score, question)

    return list(unique_questions.values())

def update_related_questions(db, env_prefix, new_question_id=None):
    questions = fetch_questions(db, env_prefix)
    all_keywords = extract_keywords(questions)

    if new_question_id:
        new_question = fetch_question_by_id(db, env_prefix, new_question_id)
        new_keywords = extract_keywords([{'id': new_question_id, 'question': new_question['question']}])[0]
        
        # Combine new keywords with existing keywords
        combined_keywords = all_keywords + [new_keywords]
        combined_questions = questions + [{'id': new_question_id, 'question': new_question['question']}]
        
        related_questions = find_related_questions(new_question['question'], combined_questions, combined_keywords, exclude_question_id=new_question_id)
        
        # Store related question IDs in Firestore
        db.collection(f"{env_prefix}_chatLogs").document(new_question_id).update({
            'relatedQuestionsV2': [{'id': q[1]['id'], 'title': q[1]['question'], 'similarity': q[0]} for q in related_questions[:5]]
        })
    else:
        for question in tqdm(questions, desc="Updating related questions"):
            related_questions = find_related_questions(question['question'], questions, all_keywords, exclude_question_id=question['id'])
            related_question_data = [{'id': q[1]['id'], 'title': q[1]['question'], 'similarity': q[0]} for q in related_questions[:5]]

            try:
                doc_ref = db.collection(f"{env_prefix}_chatLogs").document(question['id'])
                update_data = {'relatedQuestionsV2': related_question_data}
                doc_ref.update(update_data)

            except Exception as e:
                print(f"Error updating related questions for question ID {question['id']}: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Extract keywords from Firestore questions and find related questions.')
    parser.add_argument('-e', '--env', type=str, choices=['dev', 'prod'], required=True, help='Environment (dev or prod)')
    parser.add_argument('-q', '--question_id', type=str, help='Question ID to find related questions for')
    args = parser.parse_args()

    env_prefix = args.env
    try:
        db = initialize_firestore(env_prefix)
    except Exception as e:
        print(f"Error initializing Firestore: {e}")
        exit(1)

    if args.question_id:
        update_related_questions(db, env_prefix, new_question_id=args.question_id)
    else:
        update_related_questions(db, env_prefix)