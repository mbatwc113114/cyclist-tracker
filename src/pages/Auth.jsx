import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { Bike } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh'}}>
      <div className="glass-panel" style={{maxWidth: '400px', width: '100%', textAlign: 'center'}}>
        <Bike size={48} color="var(--primary-color)" style={{marginBottom: '16px'}} />
        <h2 style={{marginBottom: '24px'}}>
          {isLogin ? 'Welcome Back' : 'Join the Ride'}
        </h2>
        {error && <div style={{color: 'var(--danger-color)', marginBottom: '16px', fontSize: '14px'}}>{error}</div>}
        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '16px', textAlign: 'left'}}>
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
          <button type="submit" className="btn-primary" style={{marginTop: '8px', padding: '12px'}}>
            {isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>
        <p style={{marginTop: '24px', fontSize: '14px', color: 'var(--text-muted)'}}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span 
            style={{color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600}} 
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Sign up' : 'Login'}
          </span>
        </p>
      </div>
    </div>
  );
}
