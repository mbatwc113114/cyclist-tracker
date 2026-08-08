import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { User, Activity, MapPin, TrendingUp, ArrowLeft, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateStreak } from '../utils/streak';
import { Haptics } from '../utils/haptics';

export default function UserProfile({ user: currentUser }) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [profileUser, setProfileUser] = useState(null);
  const [stats, setStats] = useState({ totalDistance: 0, totalTime: 0 });
  const [rides, setRides] = useState([]);
  const [clubName, setClubName] = useState('');

  useEffect(() => {
    // If it's the current user, just go to their own profile page
    if (uid === currentUser.uid) {
      navigate('/profile', { replace: true });
      return;
    }

    const userRef = ref(database, `users/${uid}`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
         const data = snapshot.val();
         setProfileUser(data);
         setStats({
            totalDistance: data.totalDistance || 0,
            totalTime: data.totalTime || 0,
            clubId: data.clubId
         });
      }
    });

    const ridesRef = ref(database, `rides/${uid}`);
    const unsubscribeRides = onValue(ridesRef, (snapshot) => {
      if (snapshot.exists()) {
         const data = snapshot.val();
         const rideList = Object.keys(data)
            .map(key => ({id: key, uid: uid, ...data[key]}))
            .filter(r => !r.isCustomRoute)
            .sort((a,b) => b.date - a.date);
         setRides(rideList);
      } else {
        setRides([]);
      }
    });

    return () => {
       unsubscribeUser();
       unsubscribeRides();
    };
  }, [uid, currentUser, navigate]);

  useEffect(() => {
    if (stats.clubId) {
       const clubRef = ref(database, `clubs/${stats.clubId}`);
       const unsubscribe = onValue(clubRef, (snapshot) => {
          if (snapshot.exists()) {
             setClubName(snapshot.val().name);
          }
       });
       return () => unsubscribe();
    } else {
       setClubName('');
    }
  }, [stats.clubId]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const chartData = rides.slice(0, 10).reverse().map((r) => ({
    distance: parseFloat(r.distance),
    date: new Date(r.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
  }));

  const calculatedTotalDistance = rides.reduce((acc, ride) => acc + (parseFloat(ride.distance) || 0), 0);
  const currentStreak = calculateStreak(rides);

  if (!profileUser) {
     return (
        <div className="page-enter-active" style={{padding: 'var(--space-xxl)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', width: '100vw'}}>
           <div className="spinner" style={{width: '40px', height: '40px', border: '4px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-main)', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></div>
           <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
     );
  }

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px', padding: 'var(--space-lg)'}}>
       
       <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-xxxl)'}}>
         <button onClick={() => { Haptics.light(); navigate(-1); }} className="btn" style={{background: 'var(--surface-card-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex', boxShadow: 'var(--shadow-card)'}}>
            <ArrowLeft size={24} />
         </button>
         <h1 className="text-display" style={{margin: 0}}>Rider Profile</h1>
       </div>

       <div className="card" style={{display: 'flex', alignItems: 'center', gap: 'var(--space-md)', padding: 'var(--space-lg)', overflow: 'hidden'}}>
          {profileUser.photoURL ? (
             <img src={profileUser.photoURL} alt="User" style={{width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--primary-main)'}} referrerPolicy="no-referrer" />
          ) : (
             <div style={{width: '72px', height: '72px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <User size={40} color="white" />
             </div>
          )}
          <div style={{overflow: 'hidden'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
                <h2 className="text-h2" style={{margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{profileUser.displayName || 'Anonymous Cyclist'}</h2>
                {currentStreak > 0 && (
                   <div style={{display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--activity-calories)', fontWeight: 700, fontSize: '14px'}}>
                      <Flame size={16} fill="currentColor" />
                      {currentStreak}
                   </div>
                )}
             </div>
             {profileUser.age && <div className="text-caption" style={{color: 'var(--text-muted)'}}>{profileUser.age} years old</div>}
          </div>
       </div>

       <div className="card" style={{textAlign: 'center', padding: 'var(--space-xxl) var(--space-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'var(--space-lg)'}}>
          <div style={{display: 'flex', gap: 'var(--space-xxxl)'}}>
             <div style={{textAlign: 'center'}}>
                <div className="text-large-number">{calculatedTotalDistance.toFixed(1)}</div>
                <div className="text-label">Total Km</div>
             </div>
             <div style={{textAlign: 'center'}}>
                <div className="text-large-number">{rides.length}</div>
                <div className="text-label">Rides</div>
             </div>
          </div>
          
          {stats.clubId && (
             <div style={{marginTop: 'var(--space-xxl)', width: '100%', background: 'var(--surface-input)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{textAlign: 'left'}}>
                   <div className="text-label">Current Club</div>
                   <div className="text-body" style={{fontWeight: 700}}>{clubName || 'Loading...'}</div>
                </div>
             </div>
           )}
       </div>

       {/* Advanced Analysis Chart */}
       {rides.length > 0 && (
          <div className="card" style={{marginTop: 'var(--space-lg)', padding: 'var(--space-lg)'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xxl)'}}>
                <TrendingUp color="var(--primary-main)" />
                <h3 className="text-h3" style={{margin: 0}}>Recent Performance</h3>
             </div>
             <div style={{height: '200px', width: '100%', marginLeft: '-16px'}}>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData}>
                   <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                   <Tooltip 
                      cursor={{fill: 'var(--surface-card-elevated)'}}
                      contentStyle={{background: 'var(--surface-card-elevated)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)'}}
                      formatter={(value) => [`${value} km`, 'Distance']}
                   />
                   <Bar dataKey="distance" fill="var(--primary-main)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
       )}

       <h3 className="text-h3" style={{marginTop: 'var(--space-xxxl)', marginBottom: 'var(--space-md)'}}>Recent Rides</h3>
       <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)'}}>
           {rides.map(ride => (
             <div 
               key={ride.id} 
               className="card" 
               style={{padding: '0', overflow: 'hidden', cursor: 'pointer'}} 
               onClick={() => { Haptics.light(); navigate(`/ride/${ride.uid}/${ride.id}`); }}
             >
                <div style={{padding: 'var(--space-lg)'}}>
                   <h4 className="text-h4" style={{margin: '0 0 var(--space-md) 0'}}>{ride.title || `${new Date(ride.date).toLocaleDateString()} Ride`}</h4>
                   <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-sm)'}}>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span className="text-label">Dist</span>
                         <span className="text-body" style={{fontWeight: 700}}>{parseFloat(ride.distance).toFixed(1)} km</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span className="text-label">Time</span>
                         <span className="text-body" style={{fontWeight: 700}}>{formatTime(ride.duration)}</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span className="text-label">Avg</span>
                         <span className="text-body" style={{fontWeight: 700}}>{parseFloat(ride.averageSpeed).toFixed(1)} km/h</span>
                      </div>
                   </div>
                </div>
             </div>
           ))}
           {rides.length === 0 && (
             <p className="text-body" style={{color: 'var(--text-muted)'}}>No rides recorded yet.</p>
           )}
       </div>
    </div>
  );
}
