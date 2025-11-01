import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import axios from 'axios';

const ChatBox = forwardRef(({ user, sessionId, onTitleUpdate }, ref) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const scriptProcessorRef = useRef(null);
  const audioDataRef = useRef([]); 
  const chatRef = useRef(null);
  const utteranceRef = useRef(null);
  const initialMessageRef = useRef(null);
  useEffect(() => {
    if (!sessionId) return;
    const fetchMessages = async () => {
      try {
        const res = await axios.post('http://localhost:5000/api/session/messages', { sessionId });
        const msgs = res.data.messages || [];
        const formatted = msgs.map(msg => {
          const items = [];
          items.push({
            sender: 'user',
            text: msg.user_message,
            audio: msg.audio_path || null
          });
          if (msg.bot_reply) {
            items.push({
              sender: 'bot',
              text: msg.bot_reply
            });
          }
          return items;
        }).flat();

        if (initialMessageRef.current) {
          setMessages([...formatted, initialMessageRef.current]);
        } else {
          setMessages(formatted);
        }
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };
    fetchMessages();
  }, [sessionId]);
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);
  useEffect(() => {
    return () => { window.speechSynthesis.cancel(); };
  }, []);
  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    try {
      const res = await axios.post('http://localhost:5000/api/message', {
        message: currentInput,
        email: user.email,
        sessionId,
      });
      const botMsg = { sender: 'bot', text: res.data.reply };
      setMessages((prev) => [...prev, botMsg]);
      speakText(res.data.reply);
      if (res.data.titleChanged) {
        const newTitle = currentInput.length > 60 ? currentInput.slice(0, 60) + '...' : currentInput;
        onTitleUpdate && onTitleUpdate(sessionId, newTitle);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };
  const speakText = (text) => {
    window.speechSynthesis.cancel();
    const cleanedText = text.replace(
      /[\u{1F600}-\u{1F6FF}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ''
    );
    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onpause = () => setPaused(true);
    utterance.onresume = () => setPaused(false);
    utteranceRef.current = utterance;
    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };
  const toggleVoice = () => {
    if (!utteranceRef.current) return;
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  };
  const stopVoice = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setPaused(false);
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  useImperativeHandle(ref, () => ({
    sendMessageFromApp: async (msg, sessionIdOverride) => {
      if (!msg.trim()) return;
      initialMessageRef.current = { sender: 'user', text: msg };
      setMessages(prev => [...prev, initialMessageRef.current]);
      try {
        const res = await axios.post('http://localhost:5000/api/message', {
          message: msg,
          email: user.email,
          sessionId: sessionIdOverride || sessionId,
        });
        const botMsg = { sender: 'bot', text: res.data.reply };
        setMessages(prev => [...prev, botMsg]);
        speakText(res.data.reply);
        initialMessageRef.current = null;
      } catch (err) {
        console.error('Error sending first message:', err);
      }
    }
  }));
  const encodeWAV = (samples, sampleRate = 44100) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    const floatTo16BitPCM = (offset, input) => {
      for (let i = 0; i < input.length; i++, offset += 2) {
        let s = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
    };
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    floatTo16BitPCM(44, samples);
    return new Blob([view], { type: 'audio/wav' });
  };
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;
      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0);
        audioDataRef.current.push(new Float32Array(channelData));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecording(true);
    } catch (err) {
      console.error('Mic permission / init error:', err);
      setIsRecording(false);
    }
  };
  const stopRecording = async () => {
    try {
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const samples = mergeFloat32(audioDataRef.current);
      audioDataRef.current = [];
      const wavBlob = encodeWAV(samples, 44100);
      setIsRecording(false);
      const localURL = URL.createObjectURL(wavBlob);
      setMessages(prev => [...prev, { sender: 'user', text: '[Voice message]', audioLocal: localURL }]);
      const tempBotMsg = { sender: 'bot', text: '🎤 Processing your voice message...' };
      setMessages(prev => [...prev, tempBotMsg]);
      const formData = new FormData();
      formData.append('file', wavBlob, 'voice.wav');
      formData.append('email', user.email);
      formData.append('sessionId', sessionId);
      const res = await axios.post('http://localhost:5000/api/voice-message', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMessages(prev => {
        const updated = [...prev];
        const idx = updated.findIndex(m => m.sender === 'bot' && m.text.includes('Processing'));
        if (idx !== -1) {
          updated[idx] = { sender: 'bot', text: res.data.reply };
        } else {
          updated.push({ sender: 'bot', text: res.data.reply });
        }
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].sender === 'user' && updated[i].audioLocal) {
            updated[i] = { sender: 'user', text: res.data.transcription, audio: res.data.audioFile };
            break;
          }
        }
        return updated;
      });
      if (res.data.titleChanged) {
        const newTitle = res.data.transcription.length > 60 ? res.data.transcription.slice(0, 60) + '...' : res.data.transcription;
        onTitleUpdate && onTitleUpdate(sessionId, newTitle);
      }
      speakText(res.data.reply);
    } catch (err) {
      console.error('Error stopping/uploading recording:', err);
      setIsRecording(false);
    }
  };
  const mergeFloat32 = (chunks) => {
    let totalLength = 0;
    for (let i = 0; i < chunks.length; i++) totalLength += chunks[i].length;
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      result.set(chunks[i], offset);
      offset += chunks[i].length;
    }
    return result;
  };
  const VoiceBubble = ({ src, id }) => {
    const audioRef = useRef(null);
    const progressRef = useRef(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const togglePlay = () => {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        audio.play();
      } else {
        audio.pause();
      }
    };
    const handleTimeUpdate = () => {
      if (!audioRef.current) return;
      const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(percent);
    };
    const handleProgressClick = (e) => {
      if (!audioRef.current || !progressRef.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const newTime = (clickX / rect.width) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          background: "rgba(255,255,255,0.1)",
          padding: "8px 12px",
          borderRadius: "12px",
          width: "100%",
          cursor: "default"
        }}
      >
        {/* Play/Pause button */}
        <div
          onClick={togglePlay}
          style={{
            width: "28px",
            height: "28px",
            background: "linear-gradient(135deg, #ff6ec7, #61daefff)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "14px",
            cursor: "pointer"
          }}
        >
          {isPlaying ? "⏸" : "▶"}
        </div>
        {/* Progress bar (clickable) */}
        <div
          ref={progressRef}
          onClick={handleProgressClick}
          style={{
            flex: 1,
            height: "6px",
            background: "rgba(255,255,255,0.2)",
            borderRadius: "3px",
            position: "relative",
            overflow: "hidden",
            cursor: "pointer"
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(135deg, #ff6ec7, #61daefff)"
            }}
          />
        </div>
        <audio
          ref={audioRef}
          src={src}
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
          style={{ display: "none" }}
        />
      </div>
    );
  };
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      width: "100%",
      height: "100%",
      overflow: "hidden",
      fontFamily: "Calibri",
      background: "linear-gradient(135deg, #141416, #1b1e2b 70%)",
      color: "#f5f5f5"
    }}>
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px", width: "100%" }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            display: "flex",
            justifyContent: msg.sender === "user" ? "flex-end" : "flex-start",
            marginBottom: "14px"
          }}>
            <div style={{
              background: msg.sender === "user"
                ? "linear-gradient(135deg, #ff6ec7, #61daefff)"
                : "linear-gradient(135deg, #bfa5f8ff, #ed55fbff)",
              color: "#fff",
              padding: "12px 18px",
              borderRadius: msg.sender === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              maxWidth: "70%",
              whiteSpace: "pre-wrap",
              fontSize: "15px",
              lineHeight: "1.5",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)"
            }}>
              <div style={{ fontWeight: "bold", fontSize: "13px", marginBottom: "6px", opacity: 0.8 }}>
                {msg.sender === "user" ? "You" : "SoulTalk"}
              </div>
              {msg.text && <div style={{ marginBottom: msg.audio || msg.audioLocal ? 8 : 0 }}>{msg.text}</div>}
              {(msg.audio || msg.audioLocal) && (
                <VoiceBubble
                  src={msg.audio ? `http://localhost:5000${msg.audio}` : msg.audioLocal}
                  id={idx}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        display: "flex",
        gap: "10px",
        alignItems: "center",
        padding: "15px",
        background: "rgba(20,20,20,0.9)",
        borderTop: "1px solid #2c2c35",
        flexShrink: 0,
        width: "100%"
      }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
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
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "Stop recording" : "Record voice"}
          style={{
            background: isRecording
              ? "linear-gradient(90deg, #ff3b6b, #ff9a9e)"
              : "linear-gradient(90deg, #7ee8fa, #ff6ec7)",
            border: "none",
            borderRadius: "50%",
            width: "45px",
            height: "45px",
            color: "#fff",
            fontSize: "18px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 4px 12px rgba(255, 110, 199, 0.5)"
          }}
        >
          {isRecording ? "■" : (
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="black" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3z"/>
              <path d="M19 11a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.92V21H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-3.08A7 7 0 0 0 19 11z"/>
            </svg>
          )}
        </button>
        <button onClick={sendMessage} style={{
          background: "linear-gradient(90deg, #ff6ec7, #7ee8fa)",
          border: "none",
          borderRadius: "50%",
          width: "45px",
          height: "45px",
          color: "#111",
          fontSize: "18px",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(255, 110, 199, 0.5)"
        }}>➤</button>
        {isSpeaking && (
          <div style={{ display: "flex", gap: "8px", marginLeft: "10px" }}>
            <button onClick={toggleVoice} style={{
              padding: "8px 14px",
              borderRadius: "20px",
              border: "none",
              background: paused
                ? "linear-gradient(135deg, #ff6ec7, #2d92fdff)"
                : "linear-gradient(135deg, #6366f1, #e546cbff)",
              color: "#fff",
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 3px 6px rgba(0,0,0,0.2)"
            }}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button onClick={stopVoice} style={{
              padding: "8px 14px",
              borderRadius: "20px",
              border: "none",
              background: "linear-gradient(135deg, #c444efff, #1674f9ff)",
              color: "#fff",
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 3px 6px rgba(0,0,0,0.2)"
            }}>
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatBox;