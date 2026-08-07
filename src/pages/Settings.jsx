import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';
import { LogOut, Download, ArrowLeft } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
       alert("Your browser doesn't support manual installation, or the app is already installed! Try using Chrome or Safari's 'Add to Home Screen' option.");
       return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px', padding: '20px'}}>
      
      <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px'}}>
         <button onClick={() => navigate(-1)} style={{background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex'}}>
            <ArrowLeft size={24} />
         </button>
         <h1 style={{margin: 0}}>Settings</h1>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
         <button 
           onClick={handleInstallClick}
           className="glass-panel" 
           style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: 'none', width: '100%', color: 'white', cursor: 'pointer', textAlign: 'left', fontSize: '1rem'}}
         >
           <div style={{background: 'var(--primary-color)', padding: '12px', borderRadius: '50%', display: 'flex'}}>
              <Download size={24} color="white" />
           </div>
           <div>
              <div style={{fontWeight: 'bold'}}>Install App</div>
              <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Add K-Flow to your home screen</div>
           </div>
         </button>

         <button 
           onClick={handleLogout}
           className="glass-panel" 
           style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: 'none', width: '100%', color: 'var(--danger-color)', cursor: 'pointer', textAlign: 'left', fontSize: '1rem'}}
         >
           <div style={{background: 'rgba(255,59,48,0.2)', padding: '12px', borderRadius: '50%', display: 'flex'}}>
              <LogOut size={24} color="var(--danger-color)" />
           </div>
           <div>
              <div style={{fontWeight: 'bold'}}>Log Out</div>
              <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Sign out of your account</div>
           </div>
         </button>
      </div>

      <div style={{marginTop: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px'}}>
         K-Flow App v1.0 <br/>
         100% React PWA
      </div>
    </div>
  );
}
