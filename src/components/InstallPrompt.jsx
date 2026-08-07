import React, { useState, useEffect } from 'react';
import { Download, Share } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Only show iOS prompt if running in browser (not standalone/installed)
    const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
    if (isIosDevice && !isStandalone) {
       setShowIOSPrompt(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setShowIOSPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (showIOSPrompt) {
     return (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10000, background: 'rgba(255,255,255,0.95)', color: 'black', padding: '16px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', width: '90%', maxWidth: '350px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
           <div style={{fontWeight: 'bold', marginBottom: '8px', fontSize: '18px'}}>Install K-Flow App</div>
           <div style={{fontSize: '15px', color: '#333'}}>Tap the <Share size={18} style={{verticalAlign: 'bottom', margin: '0 4px', color: '#007AFF'}} /> Share button on your browser and select <strong>"Add to Home Screen"</strong>.</div>
           <button onClick={() => setShowIOSPrompt(false)} style={{marginTop: '16px', background: 'var(--primary-color)', color: 'white', border: 'none', padding: '8px 24px', borderRadius: '50px', fontWeight: 'bold', cursor: 'pointer'}}>Got it</button>
        </div>
     );
  }

  if (!isInstallable) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10000,
      background: 'var(--primary-color)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '50px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      cursor: 'pointer',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      fontWeight: 'bold'
    }} onClick={handleInstallClick}>
      <Download size={20} />
      Install K-Flow App
    </div>
  );
}
