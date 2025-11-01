import React from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, provider } from '../firebase';

const GoogleLoginButton = ({ onLogin }) => {
  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      onLogin(user); 
    } catch (error) {
      console.error("Google Login Error:", error.message);
    }
  };
  return (
    <button 
      onClick={handleGoogleLogin} 
      className="google-login-btn d-flex align-items-center justify-content-center shadow-sm"
    >
      <img 
        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
        alt="Google Logo" 
        className="me-2" 
        style={{ width: "20px", height: "20px" }}
      />
      <span className="fw-semibold">Sign in with Google</span>
    </button>
  );
};

export default GoogleLoginButton;
