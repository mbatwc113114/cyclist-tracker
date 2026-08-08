import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, database } from '../firebase';
import { signOut } from 'firebase/auth';
import { ref, update, get } from 'firebase/database';
import { LogOut, Download, ArrowLeft, Moon, Sun, Users, Type } from 'lucide-react';

export default function Settings({ user }) {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') !== 'light');
  const [clubInput, setClubInput] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const [currentFont, setCurrentFont] = useState(localStorage.getItem('font') || "'Inter', system-ui, sans-serif");
  const [currentTextSize, setCurrentTextSize] = useState(localStorage.getItem('textSize') || 'text-medium');

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
      navigate('/');
    } catch (error) {
      console.error("Error logging out", error);
    }
  };

  const toggleTheme = () => {
     if (isDarkMode) {
        document.body.classList.add('light-mode');
        localStorage.setItem('theme', 'light');
        setIsDarkMode(false);
     } else {
        document.body.classList.remove('light-mode');
        localStorage.setItem('theme', 'dark');
        setIsDarkMode(true);
     }
  };

  const handleFontChange = (e) => {
    const newFont = e.target.value;
    setCurrentFont(newFont);
    localStorage.setItem('font', newFont);
    document.documentElement.style.setProperty('--main-font', newFont);
  };

  const handleTextSizeChange = (e) => {
    const newSize = e.target.value;
    setCurrentTextSize(newSize);
    localStorage.setItem('textSize', newSize);
    document.body.classList.remove('text-small', 'text-medium', 'text-large');
    document.body.classList.add(newSize);
  };

  const handleJoinClub = async () => {
    if (!clubInput.trim()) return;
    if (!user) return;
    
    setJoinStatus('Checking...');
    const clubRef = ref(database, `clubs/${clubInput.trim()}`);
    const snap = await get(clubRef);
    if (!snap.exists()) {
       setJoinStatus('Club not found.');
       return;
    }

    // Join club
    await update(ref(database, `users/${user.uid}`), { clubId: clubInput.trim() });
    await update(ref(database, `clubs/${clubInput.trim()}/members`), { [user.uid]: true });
    
    setJoinStatus('Successfully joined!');
    setClubInput('');
  };

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px', padding: '20px'}}>
      
      <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px'}}>
         <button onClick={() => navigate(-1)} style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex'}}>
            <ArrowLeft size={24} />
         </button>
         <h1 style={{margin: 0}}>Settings</h1>
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
         
         {/* Theme Toggle */}
         <div className="glass-panel" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
               <div style={{background: 'var(--primary-color)', padding: '12px', borderRadius: '50%', display: 'flex'}}>
                  {isDarkMode ? <Moon size={24} color="white" /> : <Sun size={24} color="white" />}
               </div>
               <div>
                  <div style={{fontWeight: 'bold'}}>Dark Mode</div>
                  <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Toggle application theme</div>
               </div>
            </div>
            
            <label style={{position: 'relative', display: 'inline-block', width: '50px', height: '28px'}}>
               <input type="checkbox" checked={isDarkMode} onChange={toggleTheme} style={{opacity: 0, width: 0, height: 0}} />
               <span style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: isDarkMode ? 'var(--accent-color)' : 'var(--text-muted)',
                  transition: '0.4s', borderRadius: '34px'
               }}>
                  <span style={{
                     position: 'absolute', content: '""', height: '20px', width: '20px', left: '4px', bottom: '4px',
                     backgroundColor: 'white', transition: '0.4s', borderRadius: '50%',
                     transform: isDarkMode ? 'translateX(22px)' : 'translateX(0)'
                  }}></span>
               </span>
            </label>
         </div>

         {/* Font Family Selection */}
         <div className="glass-panel" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
               <div style={{background: 'var(--primary-color)', padding: '12px', borderRadius: '50%', display: 'flex'}}>
                  <Type size={24} color="white" />
               </div>
               <div>
                  <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>Font Style</div>
                  <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Choose your preferred font</div>
               </div>
            </div>
            <select 
               value={currentFont} 
               onChange={handleFontChange}
               style={{background: 'rgba(128,128,128,0.2)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', outline: 'none'}}
            >
               <option value="'Inter', system-ui, sans-serif">Inter (Default)</option>
               <option value="'Outfit', system-ui, sans-serif">Outfit</option>
               <option value="'Poppins', system-ui, sans-serif">Poppins</option>
               <option value="'Roboto', system-ui, sans-serif">Roboto</option>
            </select>
         </div>

         {/* Font Size Selection */}
         <div className="glass-panel" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
               <div style={{background: 'var(--accent-color)', padding: '12px', borderRadius: '50%', display: 'flex'}}>
                  <Type size={24} color="white" />
               </div>
               <div>
                  <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>Text Size</div>
                  <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Adjust the app text size</div>
               </div>
            </div>
            <select 
               value={currentTextSize} 
               onChange={handleTextSizeChange}
               style={{background: 'rgba(128,128,128,0.2)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '8px', outline: 'none'}}
            >
               <option value="text-small">Small</option>
               <option value="text-medium">Medium</option>
               <option value="text-large">Large</option>
            </select>
         </div>

         {/* Join Club Option */}
         <div className="glass-panel" style={{padding: '20px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px'}}>
               <div style={{background: 'var(--accent-color)', padding: '12px', borderRadius: '50%', display: 'flex'}}>
                  <Users size={24} color="white" />
               </div>
               <div>
                  <div style={{fontWeight: 'bold'}}>Join a Club</div>
                  <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Enter a Club ID to join</div>
               </div>
            </div>
            <div style={{display: 'flex', gap: '8px'}}>
               <input 
                  type="text" 
                  value={clubInput} 
                  onChange={(e) => setClubInput(e.target.value)} 
                  placeholder="Club ID..." 
                  style={{flex: 1}}
               />
               <button onClick={handleJoinClub} className="btn-primary">Join</button>
            </div>
            {joinStatus && <div style={{fontSize: '12px', color: joinStatus.includes('Success') ? 'var(--accent-color)' : 'var(--danger-color)', marginTop: '8px'}}>{joinStatus}</div>}
         </div>

         <button 
           onClick={handleInstallClick}
           className="glass-panel" 
           style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)', width: '100%', color: 'var(--text-main)', cursor: 'pointer', textAlign: 'left', fontSize: '1rem'}}
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
           style={{padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)', width: '100%', color: 'var(--danger-color)', cursor: 'pointer', textAlign: 'left', fontSize: '1rem'}}
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
