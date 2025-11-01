from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
from transformers import pipeline
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from emotion_predictor import predict_emotion_from_audio
from dotenv import load_dotenv
import cohere
import os
import uuid
import re
from collections import Counter
from werkzeug.utils import secure_filename  

UPLOAD_FOLDER = "uploads/audio"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

os.environ['HF_HOME'] = "D:/huggingface"

load_dotenv()
cohere_api_key = os.getenv("COHERE_API_KEY")
mongo_uri = os.getenv("MONGO_URI")

app = Flask(__name__)
CORS(app)

client = MongoClient(mongo_uri)
db = client['soultalk']
sessions = db['sessions']
messages_collection = db['messages']

emotion_classifier = pipeline(
    "text-classification",
    model="bhadresh-savani/distilbert-base-uncased-emotion"
)

asr_pipeline = pipeline(
    "automatic-speech-recognition",
    model="openai/whisper-base"
)

EMBEDDING_MODEL_PATH = "sentence-transformers/all-MiniLM-L6-v2"
embedding_model = SentenceTransformer(EMBEDDING_MODEL_PATH)

co = cohere.Client(cohere_api_key)

def generate_ai_reply(history, emotion):
    chat_log = "\n".join([f"User: {m['user_message']}\n {m['bot_reply']}" for m in history[:-1]])
    latest_input = history[-1]['user_message']

    prompt = f"""
You are SoulTalk, an empathetic and supportive AI companion. 
The user is feeling {emotion.lower() if emotion else 'unknown'}.

Your role is to gently respond based on the full conversation. Keep the tone supportive and friendly.

Instructions:
- Give the answers in proper structure.
- Don't make the response very big, keep it crisp and concise.
- Use emojis if needed.
- Stay emotionally in tune with the user.
- Never repeat previous responses.
- Avoid generic filler like “I'm sorry you feel that way”.

Here is the chat history:
{chat_log}
User: {latest_input}
SoulTalk:"""
    response = co.chat(
        message=prompt.strip(),
        model="command-xlarge-nightly",  
        temperature=0.6,
    )
    return response.text.strip()

def preprocess_for_title(text):
    """
    Cleans the user message for generating a meaningful title.
    Removes greetings, filler words, mentions like 'SoulTalk' or 'today',
    and trailing pronouns for cleaner titles.
    """
    text = text.lower()
    remove_words = ["heyy", "hello", "hi", "hey", "soultalk", "today", "message"]
    for w in remove_words:
        text = re.sub(rf"\b{w}\b", "", text)
    text = re.sub(r'[^\w\s]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    trailing_pronouns = ['me', 'my', 'i']
    words = text.split()
    while words and words[-1] in trailing_pronouns:
        words.pop()    
    return " ".join(words)

def generate_session_title(text):
    """
    Generates a short, simple, meaningful session title (3-4 words)
    using Cohere chat model, focusing only on main idea or feeling.
    """
    clean_text = preprocess_for_title(text)
    prompt = f"""
You are an assistant that generates a short, simple, meaningful title (3-4 words)
for the following user message. 

Instructions:
- Ignore pronouns like I, me, you, he, she, we, they.
- Ignore greetings like hi, hello, heyy.
- Ignore generic words like today, message, soultalk.
- Use plain, everyday English.
- Summarize the main idea or feeling of the message.
- Do not add unnecessary words.

User text:
{clean_text}

Title (main idea or feeling only):
"""
    try:
        response = co.chat(
            message=prompt.strip(),
            model="command-xlarge-nightly",
            temperature=0.5
        )
        title_text = response.text.strip()
        title_text = title_text.strip('\"“”')
        return title_text
    except Exception as e:
        print("❌ Error generating session title:", str(e))
        # fallback: first 3 meaningful words
        words = clean_text.split()
        return " ".join([w.capitalize() for w in words[:3]])

@app.route('/')
def home():
    return "💬 SoulTalk Backend is Running!"

@app.route('/api/session/new', methods=['POST'])
def create_session():
    data = request.get_json()
    user_email = data.get('email')
    if not user_email:
        return jsonify({'error': 'Missing email'}), 400
    session_id = str(uuid.uuid4())
    session_entry = {
        'sessionId': session_id,
        'email': user_email,
        'title': None,
        'emotion': None,
        'createdAt': datetime.now()
    }
    sessions.insert_one(session_entry)
    return jsonify({'sessionId': session_id})

@app.route('/api/session/list', methods=['POST'])
def get_sessions():
    data = request.get_json()
    user_email = data.get('email')
    if not user_email:
        return jsonify({'error': 'Missing email'}), 400
    session_list = list(sessions.find({'email': user_email}).sort('createdAt', -1))
    for s in session_list:
        s['_id'] = str(s['_id'])
        s['createdAt'] = s['createdAt'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify({'sessions': session_list})

@app.route('/api/session/messages', methods=['POST'])
def get_session_messages():
    data = request.get_json()
    session_id = data.get('sessionId')
    if not session_id:
        return jsonify({'error': 'Missing sessionId'}), 400
    msgs = list(messages_collection.find({'sessionId': session_id}).sort('timestamp', 1))
    for m in msgs:
        m['_id'] = str(m['_id'])
        m['timestamp'] = m['timestamp'].strftime('%Y-%m-%d %H:%M:%S')
    return jsonify({'messages': msgs})

@app.route('/api/message', methods=['POST'])
def handle_message():
    try:
        data = request.get_json()
        user_msg = data.get('message', '').strip()
        user_email = data.get('email')
        session_id = data.get('sessionId')
        if not user_msg or not user_email or not session_id:
            return jsonify({'error': 'Missing required data'}), 400
        session = sessions.find_one({'sessionId': session_id})
        if not session:
            return jsonify({'error': 'Invalid session'}), 404
        title_changed = False
        if not session.get('title'):
            ai_title = generate_session_title(user_msg)  
            sessions.update_one({'sessionId': session_id}, {'$set': {'title': ai_title}})
            title_changed = True
        emotion = session.get('emotion')
        if not emotion:
            result = emotion_classifier(user_msg)[0]
            emotion = result['label'].upper()
            sessions.update_one({'sessionId': session_id}, {'$set': {'emotion': emotion}})
        full_history = list(messages_collection.find(
            {'sessionId': session_id},
            {'_id': 0, 'user_message': 1, 'bot_reply': 1}
        ).sort('timestamp', 1))
        full_history.append({'user_message': user_msg, 'bot_reply': ''})
        reply = generate_ai_reply(full_history, emotion)
        msg_doc = {
            'sessionId': session_id,
            'email': user_email,
            'user_message': user_msg,
            'emotion': emotion,
            'bot_reply': reply,
            'timestamp': datetime.now()
        }
        messages_collection.insert_one(msg_doc)
        return jsonify({
            'reply': reply,
            'emotion': emotion,
            'titleChanged': title_changed
        })
    except Exception as e:
        print("❌ Error in /api/message:", str(e))
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/voice-message', methods=['POST'])
def handle_voice_message():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No audio file uploaded"}), 400
        audio_file = request.files["file"]
        user_email = request.form.get("email")
        session_id = request.form.get("sessionId")
        if not user_email or not session_id:
            return jsonify({"error": "Missing email or sessionId"}), 400
        session = sessions.find_one({"sessionId": session_id})
        if not session:
            return jsonify({"error": "Invalid session"}), 404
        filename = f"{uuid.uuid4().hex}.wav"
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        audio_file.save(save_path)
        emotion = predict_emotion_from_audio(save_path)
        if emotion == "UNCLEAR":
            msg_doc = {
                "sessionId": session_id,
                "email": user_email,
                "user_message": "[Unclear voice message]",
                "audio_path": f"/uploads/audio/{filename}",
                "emotion": "UNCLEAR",
                "confidence": None,
                "bot_reply": "⚠ Voice message not clear, please try again.",
                "timestamp": datetime.now()
            }
            messages_collection.insert_one(msg_doc)
            return jsonify({
                "reply": "⚠ Voice message not clear, please try again.",
                "emotion": "UNCLEAR",
                "transcription": "",
                "audioFile": f"/uploads/audio/{filename}",
                "titleChanged": False
            })
        transcription = asr_pipeline(save_path)["text"]
        title_changed = False
        if not session.get("title"):
            ai_title = generate_session_title(transcription) 
            sessions.update_one({"sessionId": session_id}, {"$set": {"title": ai_title}})
            title_changed = True
        user_msg = transcription
        full_history = list(messages_collection.find(
            {"sessionId": session_id},
            {"_id": 0, "user_message": 1, "bot_reply": 1}
        ).sort("timestamp", 1))
        full_history.append({"user_message": user_msg, "bot_reply": ""})
        reply = generate_ai_reply(full_history, emotion)
        msg_doc = {
            "sessionId": session_id,
            "email": user_email,
            "user_message": user_msg,
            "audio_path": f"/uploads/audio/{filename}",
            "emotion": emotion,
            "confidence": None,
            "bot_reply": reply,
            "timestamp": datetime.now()
        }
        messages_collection.insert_one(msg_doc)
        return jsonify({
            "reply": reply,
            "emotion": emotion,
            "transcription": transcription,
            "audioFile": f"/uploads/audio/{filename}",
            "titleChanged": title_changed
        })
    except Exception as e:
        print("❌ Error in /api/voice-message:", str(e))
        return jsonify({"error": "Internal server error"}), 500

@app.route('/api/session/delete', methods=['POST'])
def delete_session():
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        user_email = data.get('email')
        
        if not session_id or not user_email:
            return jsonify({'error': 'Missing sessionId or email'}), 400
            
        session = sessions.find_one({'sessionId': session_id, 'email': user_email})
        if not session:
            return jsonify({'error': 'Session not found or unauthorized'}), 404
            
        messages_collection.delete_many({'sessionId': session_id})
        
        sessions.delete_one({'sessionId': session_id, 'email': user_email})
        
        return jsonify({'success': True, 'message': 'Session deleted successfully'})
        
    except Exception as e:
        print("❌ Error in /api/session/delete:", str(e))
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/session/rename', methods=['POST'])
def rename_session():
    try:
        data = request.get_json()
        session_id = data.get('sessionId')
        new_title = data.get('title', '').strip()
        user_email = data.get('email')
        
        if not session_id or not new_title or not user_email:
            return jsonify({'error': 'Missing sessionId, title, or email'}), 400
            
        session = sessions.find_one({'sessionId': session_id, 'email': user_email})
        if not session:
            return jsonify({'error': 'Session not found or unauthorized'}), 404
            
        result = sessions.update_one(
            {'sessionId': session_id, 'email': user_email},
            {'$set': {'title': new_title}}
        )
        
        if result.modified_count > 0:
            return jsonify({'success': True, 'message': 'Session renamed successfully'})
        else:
            return jsonify({'error': 'Failed to rename session'}), 500
            
    except Exception as e:
        print("❌ Error in /api/session/rename:", str(e))
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/uploads/audio/<filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    app.run(debug=True)