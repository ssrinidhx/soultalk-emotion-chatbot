import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2, Edit2, Check, X } from "lucide-react";

const Sidebar = ({ user, onSelectSession, currentSessionId, onNewChat, refreshTrigger, onSessionDeleted }) => {
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [hoveredSession, setHoveredSession] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, sessionId: null, sessionTitle: '' });

  const fetchSessions = async () => {
    try {
      const res = await axios.post('http://localhost:5000/api/session/list', {
        email: user.email
      });
      setSessions(res.data.sessions);
    } catch (err) {
      console.error("Error fetching sessions:", err);
    }
  };

  useEffect(() => {
    if (user?.email) {
      fetchSessions();
    }
  }, [user, refreshTrigger]);

  const handleDeleteSession = (sessionId, sessionTitle, e) => {
    e.stopPropagation();
    setDeleteConfirm({ 
      show: true, 
      sessionId: sessionId, 
      sessionTitle: sessionTitle || 'New Chat'
    });
  };

  const confirmDelete = async () => {
    try {
      await axios.post('http://localhost:5000/api/session/delete', {
        sessionId: deleteConfirm.sessionId,
        email: user.email
      });
      
      // Notify parent if current session was deleted
      if (currentSessionId === deleteConfirm.sessionId) {
        onSessionDeleted();
      }
      
      // Refresh sessions list
      fetchSessions();
      setDeleteConfirm({ show: false, sessionId: null, sessionTitle: '' });
    } catch (err) {
      console.error("Error deleting session:", err);
      alert('Failed to delete chat. Please try again.');
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ show: false, sessionId: null, sessionTitle: '' });
  };

  const handleStartRename = (session, e) => {
    e.stopPropagation();
    setEditingId(session.sessionId);
    setEditTitle(session.title || 'New Chat');
  };

  const handleSaveRename = async (sessionId, e) => {
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingId(null);
      return;
    }
    
    try {
      await axios.post('http://localhost:5000/api/session/rename', {
        sessionId: sessionId,
        title: editTitle.trim(),
        email: user.email
      });
      
      setEditingId(null);
      fetchSessions();
    } catch (err) {
      console.error("Error renaming session:", err);
      alert('Failed to rename chat. Please try again.');
    }
  };

  const handleCancelRename = (e) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  return (
    <div
      style={{
        width: "260px",
        height: "100vh",
        background: "linear-gradient(135deg, #141416, #1b1e2b 70%)",
        borderRight: "1px solid #2c2c35",
        display: "flex",
        flexDirection: "column",
        padding: "12px",
        boxSizing: "border-box",
        color: "#f5f5f5",
        fontFamily: "Calibri",
      }}
    >
      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        style={{
          width: "100%",
          padding: "12px",
          background: "linear-gradient(90deg, #ff6ec7, #7ee8fa)",
          color: "#fff",
          border: "none",
          borderRadius: "12px",
          fontSize: "15px",
          fontWeight: "500",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          marginBottom: "18px",
          boxShadow: "0 4px 12px rgba(255,110,199,0.4)",
        }}
        onMouseOver={(e) => e.currentTarget.style.opacity = 0.85}
        onMouseOut={(e) => e.currentTarget.style.opacity = 1}
      >
        <Plus size={18} />
        New Chat
      </button>

      {/* Chat Sessions */}
      <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
        {sessions.map((session) => (
          <div
            key={session.sessionId}
            onClick={() => editingId !== session.sessionId && onSelectSession(session.sessionId)}
            onMouseEnter={() => setHoveredSession(session.sessionId)}
            onMouseLeave={() => setHoveredSession(null)}
            style={{
              padding: "10px 12px",
              marginBottom: "8px",
              background: currentSessionId === session.sessionId
                ? "linear-gradient(135deg, #6366f1, #ff6ec7)" // active gradient
                : "rgba(50,50,60,0.8)",                          // inactive dark
              borderRadius: "10px",
              cursor: editingId === session.sessionId ? "text" : "pointer",
              border: currentSessionId === session.sessionId
                ? "1px solid #ff6ec7"
                : "1px solid #2c2c35",
              fontSize: "14px",
              fontWeight: currentSessionId === session.sessionId ? "600" : "500",
              color: "#f5f5f5",
              transition: "all 0.2s ease-in-out",
              boxShadow: currentSessionId === session.sessionId
                ? "0 2px 8px rgba(255,110,199,0.3)"
                : "none",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Chat Title or Edit Input */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editingId === session.sessionId ? (
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveRename(session.sessionId, e);
                    } else if (e.key === 'Escape') {
                      handleCancelRename(e);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#f5f5f5",
                    fontSize: "14px",
                    fontWeight: "inherit",
                    width: "100%",
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <span style={{ 
                  display: "block", 
                  overflow: "hidden", 
                  textOverflow: "ellipsis", 
                  whiteSpace: "nowrap" 
                }}>
                  {session.title ? session.title : "New Chat"}
                </span>
              )}
            </div>
            
            {/* Action Buttons */}
            {(hoveredSession === session.sessionId || editingId === session.sessionId) && (
              <div style={{
                display: "flex",
                gap: "4px",
                marginLeft: "8px",
                flexShrink: 0,
              }}>
                {editingId === session.sessionId ? (
                  <>
                    <button
                      onClick={(e) => handleSaveRename(session.sessionId, e)}
                      style={{
                        background: "rgba(34, 197, 94, 0.2)",
                        border: "1px solid rgba(34, 197, 94, 0.4)",
                        borderRadius: "4px",
                        padding: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#22c55e",
                      }}
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={handleCancelRename}
                      style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: "4px",
                        padding: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ef4444",
                      }}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => handleStartRename(session, e)}
                      style={{
                        background: "rgba(168, 85, 247, 0.2)",
                        border: "1px solid rgba(168, 85, 247, 0.4)",
                        borderRadius: "4px",
                        padding: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#a855f7",
                      }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(session.sessionId, session.title, e)}
                      style={{
                        background: "rgba(239, 68, 68, 0.2)",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        borderRadius: "4px",
                        padding: "4px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ef4444",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            fontFamily: "Calibri",
          }}
          onClick={cancelDelete}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #1b1e2b, #2c2c35)",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)",
              border: "1px solid #3c3c45",
              color: "#f5f5f5",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "rgba(239, 68, 68, 0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                  border: "2px solid rgba(239, 68, 68, 0.4)",
                }}
              >
                <Trash2 size={24} color="#ef4444" />
              </div>
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  marginBottom: "8px",
                  color: "#f5f5f5",
                }}
              >
                Delete Chat?
              </h3>
              <p
                style={{
                  fontSize: "14px",
                  color: "#a0a0a0",
                  marginBottom: "0",
                  lineHeight: "1.4",
                }}
              >
                Are you sure you want to delete{" "}
                <strong style={{ color: "#ff6ec7" }}>'{deleteConfirm.sessionTitle}'</strong>?
                <br />
                This action cannot be undone.
              </p>
            </div>
            
            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
              }}
            >
              <button
                onClick={cancelDelete}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "1px solid #4c4c55",
                  background: "rgba(60, 60, 69, 0.8)",
                  color: "#f5f5f5",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",                  
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = "rgba(70, 70, 80, 0.8)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = "rgba(60, 60, 69, 0.8)";
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  padding: "10px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(90deg, #ef4444, #dc2626)",
                  color: "#fff",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.4)",
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = "1";
                }}
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;