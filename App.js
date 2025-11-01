import React, { useState, useEffect, useRef } from 'react';
import GoogleLoginButton from './components/GoogleLoginButton';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import ChatBox from './components/ChatBox';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [newMessageInput, setNewMessageInput] = useState("");
  const chatBoxRef = useRef(null);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);
  const handleLogout = () => {
    setUser(null);
    setCurrentSessionId(null);
  };
  const handleNewChat = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/session/new', {
        email: user.email,
      });
      setCurrentSessionId(res.data.sessionId);
      setRefreshKey(prev => prev + 1);
    } catch (err) {
      console.error("Error creating session:", err);
    }
  };
  
  const handleSessionDeleted = () => {
    setCurrentSessionId(null);
    setRefreshKey(prev => prev + 1);
  };
  const handleStartNewChat = async () => {
    if (!newMessageInput.trim()) return;
    try {
      const res = await axios.post('http://localhost:5000/api/session/new', {
        email: user.email,
      });
      const sessionId = res.data.sessionId;
      setCurrentSessionId(sessionId);
      setRefreshKey(prev => prev + 1);
      setTimeout(() => {
        if (chatBoxRef.current) {
          chatBoxRef.current.sendMessageFromApp(newMessageInput, sessionId); 
          setNewMessageInput(""); 
        }
      }, 100); 
    } catch (err) {
      console.error("Error starting new chat:", err);
    }
  };
  const handleNewMessageKeyDown = (e) => {
    if (e.key === "Enter" && newMessageInput.trim()) {
      handleStartNewChat();
    }
  };
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader-card text-center">
          <div className="loader-circle"></div>
          <h3 className="mt-3">Loading SoulTalk...</h3>
        </div>
      </div>
    );
  }
  if (!user) {
    return (
      <div className="unauthenticated-view hybrid-theme">
        <nav className="navbar glass-nav sticky-top">
          <div className="container-fluid d-flex justify-content-between align-items-center">
            <span className="navbar-brand fw-bold fs-3 gradient-text me-auto">
              SoulTalk 💬
            </span>
            <GoogleLoginButton onLogin={setUser} />
          </div>
        </nav>
        <section className="hero-section hybrid-hero">
          <div className="container text-center hero-content">
            <h1 className="display-4 fw-bold fade-in-up">Speak. Feel. Heal.</h1>
            <p className="lead fade-in-up">Your AI companion who listens deeply and responds with empathy!</p>
            <div className="mt-4">
              <a href="#features" className="btn btn-gradient btn-lg">Explore Features ↓</a>
            </div>
          </div>
        </section>
        <section className="features-section py-5" id="features">
          <div className="container text-center">
            <h2 className="fw-semibold mb-5 gradient-text">Why Choose SoulTalk?</h2>
            <div className="row g-4">
              {[
                { icon: "🎤", title: "Voice & Text Chat", desc: "Switch between speaking and typing effortlessly." },
                { icon: "💡", title: "Emotion Detection", desc: "Understands how you feel, not just what you say." },
                { icon: "⚡", title: "Smart Context", desc: "Conversations pick up exactly where you left off." },
                { icon: "🔒", title: "Private & Secure", desc: "Your chats are yours — always safe and encrypted." }
              ].map((feat, i) => (
                <div className="col-md-3" key={i}>
                  <div className="feature-card">
                    <div className="icon">{feat.icon}</div>
                    <h5>{feat.title}</h5>
                    <p>{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="how-section py-5">
          <div className="container text-center">
            <h2 className="fw-semibold mb-5 gradient-text">How SoulTalk Works?</h2>
            <div className="row text-center g-4">
              {[
                { step: "1", title: "Sign In", desc: "Login securely with Google to begin." },
                { step: "2", title: "Start Chat", desc: "Talk or type your thoughts — SoulTalk listens." },
                { step: "3", title: "Feel Better", desc: "Get calm, empathetic responses every time." }
              ].map((s, i) => (
                <div className="col-md-4" key={i}>
                  <div className="step-card">
                    <div className="step-number">{s.step}</div>
                    <h5>{s.title}</h5>
                    <p>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
        <footer className="footer py-3 text-center">
          <p className="small">
            © {new Date().getFullYear()} SoulTalk – Your AI companion for heartfelt conversations.
          </p>
        </footer>
      </div>
    );
  }
  return (
    <div className="app-container hybrid-theme">
      <Sidebar
        user={user}
        onSelectSession={setCurrentSessionId}
        currentSessionId={currentSessionId}
        onNewChat={handleNewChat}
        refreshTrigger={refreshKey}
        onSessionDeleted={handleSessionDeleted}
      />
      <div className="main-content pastel-theme">
        <Topbar user={user} onLogout={handleLogout} />
        <div className="chat-area">
          {currentSessionId ? (
            <ChatBox ref={chatBoxRef} user={user} sessionId={currentSessionId} />
          ) : (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              padding: "40px",
              color: "#f5f5f5",
              fontFamily: "Calibri"
            }}>
              <h2 style={{
                marginBottom: "20px",
                fontSize: "1.8rem",
                background: "linear-gradient(135deg,#ff6ec7,#61daefff)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent"
              }}>
                Hey {user.displayName}!
              </h2>
              <p style={{ marginBottom: "30px", fontSize: "1rem", opacity: 0.8 }}>
                Start a new chat!
              </p>
              <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "500px" }}>
                <input
                  type="text"
                  placeholder="Type your message to start..."
                  value={newMessageInput}
                  onChange={(e) => setNewMessageInput(e.target.value)}
                  onKeyDown={handleNewMessageKeyDown}
                  style={{
                    flex: 1,
                    padding: "12px 15px",
                    borderRadius: "25px",
                    border: "1px solid #333",
                    fontSize: "15px",
                    outline: "none",
                    background: "#1b1e2b",
                    color: "#f5f5f5"
                  }}
                />
                <button
                  onClick={handleStartNewChat}
                  style={{
                    background: "linear-gradient(90deg, #ff6ec7, #7ee8fa)",
                    border: "none",
                    borderRadius: "50%",
                    width: "45px",
                    height: "45px",
                    color: "#111",
                    fontSize: "18px",
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(255, 110, 199, 0.5)"
                  }}
                >
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;