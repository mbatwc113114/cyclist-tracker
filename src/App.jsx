import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, database } from './firebase';
import { ref, set, get, update } from 'firebase/database';
import Navigation from './components/Navigation';
import Feed from './pages/Feed';
import Record from './pages/Record';
import Profile from './pages/Profile';
import MapExplorer from './pages/MapExplorer';
import Clubs from './pages/Clubs';
import Home from './pages/Home';
import RideDetail from './pages/RideDetail';
import Settings from './pages/Settings';
import InstallPrompt from './components/InstallPrompt';
import './App.css';

function AppContent({ user }) {
  const location = useLocation();
  const isFullScreen = location.pathname === '/record' || location.pathname.startsWith('/ride/');
  
  return (
    <div className="app-container">
      <InstallPrompt />
      {user && !isFullScreen && <Navigation />}
      <main className={isFullScreen ? "record-content" : "main-content"}>
        <Routes>
          <Route path="/" element={!user ? <Home /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={user ? <Feed user={user} /> : <Navigate to="/" />} />
          <Route path="/record" element={user ? <Record user={user} /> : <Navigate to="/" />} />
          <Route path="/ride/:uid/:rideId" element={user ? <RideDetail /> : <Navigate to="/" />} />
          <Route path="/profile" element={user ? <Profile user={user} /> : <Navigate to="/" />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/" />} />
          <Route path="/maps" element={user ? <MapExplorer user={user} /> : <Navigate to="/" />} />
          <Route path="/clubs" element={user ? <Clubs user={user} /> : <Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
       document.body.classList.add('light-mode');
    } else {
       document.body.classList.remove('light-mode');
    }

    const savedFont = localStorage.getItem('font') || "'Inter', system-ui, sans-serif";
    document.documentElement.style.setProperty('--main-font', savedFont);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
        const userRef = ref(database, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        if (!snapshot.exists()) {
           set(userRef, {
             displayName: currentUser.displayName,
             photoURL: currentUser.photoURL,
             email: currentUser.email,
             totalDistance: 0,
             totalTime: 0
           });
        } else {
           // just update login time
           update(userRef, { lastLogin: Date.now(), displayName: currentUser.displayName, photoURL: currentUser.photoURL });
        }
      }
    });
    return unsubscribe;
  }, []);

  if (loading) return <div className="app-container"><div className="main-content" style={{textAlign: 'center', marginTop: '100px'}}><h2>Loading Cyclist Tracker...</h2></div></div>;

  return (
    <Router>
      <AppContent user={user} />
    </Router>
  );
}

export default App;
