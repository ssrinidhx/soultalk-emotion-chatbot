# SoulTalk – Emotional Wellness Chatbot

SoulTalk is a web-based emotional wellness chatbot designed to help users reflect on and manage their emotions through natural conversation. It combines text understanding and voice-tone analysis to detect emotional states using advanced NLP and audio processing pipelines, and responds empathetically with CBT-inspired supportive messages.

# Features:

## Text & Voice Interaction:
- Accepts both typed and spoken inputs.
- Detects emotional state from text (DistilBERT) and audio (librosa + ML).
- Generates concise, supportive, CBT-style responses.

## Session Management:
- Persistent sessions stored in MongoDB.
- Users can view session history and continue previous conversations.
- Sessions support text and voice messages with emotion metadata.

## AI and Emotion Fusion:
- Combines text and audio predictions for accurate emotion detection.
- Generates context-aware responses using Cohere’s command-xlarge-nightly model.
- Session titles are automatically generated based on conversation content.

## Audio Handling
- Upload .wav voice messages.
- Automatic Speech Recognition (ASR) via Whisper (openai/whisper-base).
- Voice emotion detection using the custom emotion_predictor module.

# Backend API Endpoints:
| **Endpoint**                | **Method** | **Description**                                                     |
|-----------------------------|------------|---------------------------------------------------------------------|
| `/api/session/new`          | POST       | Create a new chat session.                                          |
| `/api/session/list`         | POST       | List all user sessions.                                             |
| `/api/session/messages`     | POST       | Fetch messages for a session.                                       |
| `/api/message`              | POST       | Send a text message; returns AI reply with emotion.                 |
| `/api/voice-message`        | POST       | Upload voice message; returns transcription, AI reply, and emotion. |
| `/uploads/audio/<filename>` | GET        | Serve stored audio files.                                           |
| `/api/session/delete`       | POST       | Delete a session and its messages.                                  |
| `/api/session/rename`       | POST       | Rename a session.                                                   |


# Tech Stack & Roles:
| **Category**     | **Technologies / Tools**                             | **Role**                                           |
|------------------|-----------------------------------------------------|-----------------------------------------------------|
| Frontend         | React.js, HTML5, CSS3, Bootstrap, Web Speech API    | Builds interactive UI and handles text/voice input. |
| Backend          | Python, Flask, Flask-CORS, python-dotenv            | Handles API, NLP processing, session management.    |
| Database         | MongoDB (PyMongo)                                   | Stores sessions, messages, and audio metadata.      |
| NLP Models       | DistilBERT (text emotion), Cohere API (chat & title)| Emotion detection & conversational responses.       |
| Audio Processing | Whisper ASR, Librosa, scikit-learn                  | Speech-to-text and audio emotion detection.         |
| Embeddings       | SentenceTransformers (all-MiniLM-L6-v2)             | Semantic similarity and context understanding.      |
| Storage          | Local file system (`uploads/audio`)                 | Stores uploaded voice messages.                     |

# Project Structure:
```
SoulTalk/
│
├── backend/
│   ├── app.py
│   ├── emotion_predictor.py
│   ├── requirements.txt
│   ├── tools/
│   │   └── ffmpeg
│   ├── uploads/audio/
│   ├── .env
│   └── venv/
│
├── frontend/
│   ├── public/
│   │   ├── index.html
│   │   └── SoulTalk.png
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── firebase.js
│   │   ├── index.js
│   │   └── components/
│   │       ├── ChatBox.js
│   │       ├── GoogleLoginButton.js
│   │       ├── Sidebar.js
│   │       └── Topbar.js
│   ├── package.json
│   └── package-lock.json
│
├── .gitignore
└── README.md
```

# How It Works:
1. User logs in via Google or directly enters text/voice.
2. Text messages:
   - Emotion classified using **DistilBERT**.
   - Session title generated if missing via **Cohere** summarization.
   - AI reply generated via **Cohere chat model**.
3. Voice messages:
   - Saved in `uploads/audio`.
   - Emotion predicted using `emotion_predictor`.
   - Transcribed via **Whisper ASR**.
   - Same title/reply flow as text messages.
4. Replies are sent back to the frontend and displayed in the chat interface.

# Future Enhancements:
**Emotion Trend Visualizer:** chart emotion history using Chart.js/D3.js.
**Personalized Journals:** export session-wise conversation logs.
**Multilingual Support:** add Hindi, Tamil, or other languages.
**Mobile Integration:** React Native client with push notifications.
**Resource Recommendations:** personalized music or meditation playlists.
**Enhanced Security:** server-side auth, rate limiting, and encrypted audio storage.

# Environment Variables:
- `COHERE_API_KEY` – Cohere API key for AI responses.
- `MONGO_URI` – MongoDB connection URI.

# Credits:
- **Cohere API** – Generative AI for conversational replies.
- **Hugging Face Transformers** – NLP models for emotion detection & ASR.
- **Librosa / scikit-learn** – Audio feature extraction & classification.
- **React.js / Bootstrap** – Frontend UI.
- **MongoDB** – Persistent session and message storage.
