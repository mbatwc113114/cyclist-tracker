import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
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
import UserProfile from './pages/UserProfile';
import ClubDetail from './pages/ClubDetail';
import InstallPrompt from './components/InstallPrompt';
import { DataProvider } from './contexts/DataContext';
import './App.css';

function AppContent({ user }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isFullScreen = location.pathname === '/record' || location.pathname.startsWith('/ride/');
  
  useEffect(() => {
    if (user) {
       const pendingClub = localStorage.getItem('pendingClubJoin');
       if (pendingClub) {
          localStorage.removeItem('pendingClubJoin');
          navigate(`/club/${pendingClub}`);
       }
    }
  }, [user, navigate]);
  
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
          <Route path="/settings" element={user ? <Settings user={user} /> : <Navigate to="/" />} />
          <Route path="/maps" element={user ? <MapExplorer user={user} /> : <Navigate to="/" />} />
          <Route path="/clubs" element={user ? <Clubs user={user} /> : <Navigate to="/" />} />
          <Route path="/club/:clubId" element={<ClubRouteWrapper user={user} />} />
          <Route path="/user/:uid" element={user ? <UserProfile user={user} /> : <Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

function ClubRouteWrapper({ user }) {
   const { clubId } = useParams();
   
   if (!user) {
      localStorage.setItem('pendingClubJoin', clubId);
      return <Navigate to="/" />;
   }
   
   return <ClubDetail user={user} />;
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

    const savedTextSize = localStorage.getItem('textSize') || 'text-medium';
    document.body.classList.remove('text-small', 'text-medium', 'text-large');
    document.body.classList.add(savedTextSize);
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
           const userData = snapshot.val();
           let foundClubId = userData.clubId;
           
           // Self-healing: if user is in a club's members list but missing clubId
           if (!foundClubId) {
              const clubsSnap = await get(ref(database, 'clubs'));
              if (clubsSnap.exists()) {
                 const clubsData = clubsSnap.val();
                 for (const [cId, club] of Object.entries(clubsData)) {
                    if (club.members && club.members[currentUser.uid]) {
                       foundClubId = cId;
                       break;
                    }
                 }
              }
           }

           const updates = { lastLogin: Date.now(), displayName: currentUser.displayName, photoURL: currentUser.photoURL };
           if (foundClubId && !userData.clubId) {
              updates.clubId = foundClubId;
           }

           // just update login time and potentially missing clubId
           update(userRef, updates);
        }
      }
    });
    return unsubscribe;
  }, []);

  if (loading) return <div className="app-container"><div className="main-content" style={{textAlign: 'center', marginTop: '100px'}}><h2>Loading Cyclist Tracker...</h2></div></div>;

  return (
    <Router>
      <DataProvider user={user}>
        <AppContent user={user} />
      </DataProvider>
    </Router>
  );
}

export default App;
