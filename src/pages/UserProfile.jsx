import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { User, Activity, MapPin, TrendingUp, ArrowLeft, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { calculateStreak } from '../utils/streak';

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
     return <div className="page-enter-active" style={{padding: '20px'}}>Loading profile...</div>;
  }

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px'}}>
       
       <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px'}}>
         <button onClick={() => navigate(-1)} style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex'}}>
            <ArrowLeft size={24} />
         </button>
         <h1 style={{margin: 0}}>Rider Profile</h1>
       </div>

       <div className="glass-panel" style={{display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', overflow: 'hidden'}}>
          {profileUser.photoURL ? (
             <img src={profileUser.photoURL} alt="User" style={{width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--primary-color)'}} referrerPolicy="no-referrer" />
          ) : (
             <div style={{width: '72px', height: '72px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                <User size={40} color="white" />
             </div>
          )}
          <div style={{overflow: 'hidden'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                <h2 style={{margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{profileUser.displayName || 'Anonymous Cyclist'}</h2>
                {currentStreak > 0 && (
                   <div style={{display: 'flex', alignItems: 'center', gap: '2px', color: '#ff9800', fontWeight: 'bold', fontSize: '14px'}}>
                      <Flame size={16} fill="#ff9800" />
                      {currentStreak}
                   </div>
                )}
             </div>
             {profileUser.age && <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>{profileUser.age} years old</div>}
          </div>
       </div>

       <div className="glass-panel" style={{textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '24px'}}>
          <div style={{display: 'flex', gap: '24px'}}>
             <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '24px', fontWeight: 'bold'}}>{calculatedTotalDistance.toFixed(1)}</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Total Km</div>
             </div>
             <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '24px', fontWeight: 'bold'}}>{rides.length}</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Rides</div>
             </div>
          </div>
          
          {stats.clubId && (
             <div style={{marginTop: '24px', width: '100%', background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{textAlign: 'left'}}>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Current Club</div>
                   <div style={{fontWeight: 'bold'}}>{clubName || 'Loading...'}</div>
                </div>
             </div>
           )}
       </div>

       {/* Advanced Analysis Chart */}
       {rides.length > 0 && (
          <div className="glass-panel" style={{marginTop: '24px', padding: '16px'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px'}}>
                <TrendingUp color="var(--primary-color)" />
                <h3 style={{margin: 0}}>Recent Performance</h3>
             </div>
             <div style={{height: '200px', width: '100%', marginLeft: '-16px'}}>
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={chartData}>
                   <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                   <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.05)'}}
                      contentStyle={{background: 'var(--bg-panel)', border: 'none', borderRadius: '8px', color: 'var(--text-main)'}}
                      formatter={(value) => [`${value} km`, 'Distance']}
                   />
                   <Bar dataKey="distance" fill="var(--primary-color)" radius={[6, 6, 0, 0]} maxBarSize={40} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>
       )}

       <h3 style={{marginTop: '32px', marginBottom: '16px'}}>Recent Rides</h3>
       <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
           {rides.map(ride => (
             <div 
               key={ride.id} 
               className="glass-panel" 
               style={{padding: '0', overflow: 'hidden', cursor: 'pointer'}} 
               onClick={() => navigate(`/ride/${ride.uid}/${ride.id}`)}
             >
                <div style={{padding: '16px'}}>
                   <h4 style={{margin: '0 0 12px 0'}}>{ride.title || `${new Date(ride.date).toLocaleDateString()} Ride`}</h4>
                   <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px'}}>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Dist</span>
                         <span style={{fontWeight: 'bold'}}>{parseFloat(ride.distance).toFixed(1)} km</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Time</span>
                         <span style={{fontWeight: 'bold'}}>{formatTime(ride.duration)}</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Avg</span>
                         <span style={{fontWeight: 'bold'}}>{parseFloat(ride.averageSpeed).toFixed(1)} km/h</span>
                      </div>
                   </div>
                </div>
             </div>
           ))}
           {rides.length === 0 && (
             <p style={{color: 'var(--text-muted)'}}>No rides recorded yet.</p>
           )}
       </div>
    </div>
  );
}
