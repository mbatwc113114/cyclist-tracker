import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue, update } from 'firebase/database';
import { User, Activity, MapPin, ChevronRight, TrendingUp, Settings } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Profile({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalDistance: 0, totalTime: 0, dailyGoal: 10 });
  const [myRides, setMyRides] = useState([]);
  const [goalInput, setGoalInput] = useState('');
  const [clubName, setClubName] = useState('');

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

  useEffect(() => {
    const userRef = ref(database, `users/${user.uid}`);
    onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
         const data = snapshot.val();
         setStats(data);
         setGoalInput(data.dailyGoal || 10);
      }
    });

    const ridesRef = ref(database, `rides/${user.uid}`);
    onValue(ridesRef, (snapshot) => {
      if (snapshot.exists()) {
         const data = snapshot.val();
         const rideList = Object.keys(data).map(key => ({id: key, uid: user.uid, ...data[key]})).sort((a,b) => b.date - a.date);
         setMyRides(rideList);
      } else {
        setMyRides([]);
      }
    });
  }, [user.uid]);

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleSaveGoal = () => {
    import('firebase/database').then(({ update, ref: dbRef }) => {
       update(dbRef(database, `users/${user.uid}`), { dailyGoal: parseFloat(goalInput) || 10 });
    });
  };

  const handleLeaveClub = () => {
    if (!stats.clubId) return;
    import('firebase/database').then(({ update, ref: dbRef }) => {
       const updates = {};
       updates[`users/${user.uid}/clubId`] = null;
       updates[`clubs/${stats.clubId}/members/${user.uid}`] = null;
       update(dbRef(database), updates);
    });
  };

  const chartData = myRides.slice(0, 10).reverse().map((r) => ({
    distance: parseFloat(r.distance),
    date: new Date(r.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
  }));

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px'}}>
       
       <div className="glass-panel" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px', marginTop: '16px'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
             {user?.photoURL ? (
                <img src={user.photoURL} alt="User" style={{width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--primary-color)'}} referrerPolicy="no-referrer" />
             ) : (
                <div style={{width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                   <User size={32} color="white" />
                </div>
             )}
             <div>
                <h2 style={{margin: 0}}>{user?.displayName || 'Anonymous Cyclist'}</h2>
                <div style={{color: 'var(--text-muted)'}}>{user?.email}</div>
             </div>
          </div>
          <button onClick={() => navigate('/settings')} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px'}}>
             <Settings size={28} />
          </button>
       </div>

       <div className="glass-panel" style={{textAlign: 'center', padding: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '24px'}}>
          <div style={{display: 'flex', gap: '24px'}}>
             <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '24px', fontWeight: 'bold'}}>{Number(stats.totalDistance || 0).toFixed(1)}</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Total Km</div>
             </div>
             <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '24px', fontWeight: 'bold'}}>{myRides.length}</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Rides</div>
             </div>
          </div>
          
          {stats.clubId && (
             <div style={{marginTop: '24px', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{textAlign: 'left'}}>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Current Club</div>
                   <div style={{fontWeight: 'bold'}}>{clubName || 'Loading...'}</div>
                </div>
                <button onClick={handleLeaveClub} className="btn-secondary" style={{color: 'var(--danger-color)', borderColor: 'var(--danger-color)', padding: '6px 12px'}}>Leave Club</button>
             </div>
           )}

          <div style={{marginTop: '24px', width: '100%', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px'}}>
             <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase'}}>Daily Distance Goal (km)</div>
             <div style={{display: 'flex', gap: '8px'}}>
                <input 
                   type="number" 
                   value={goalInput} 
                   onChange={(e) => setGoalInput(e.target.value)} 
                   style={{flex: 1, padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'var(--text-main)'}}
                />
                <button onClick={handleSaveGoal} className="btn-primary" style={{padding: '8px 16px'}}>Save</button>
             </div>
          </div>
       </div>

       {/* Advanced Analysis Chart */}
       {myRides.length > 0 && (
          <div className="glass-panel" style={{marginTop: '24px', padding: '24px'}}>
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

       <h3 style={{marginTop: '32px', marginBottom: '16px'}}>My Recent Rides</h3>
       <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {myRides.map(ride => (
             <div 
               key={ride.id} 
               className="glass-panel" 
               style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer'}}
               onClick={() => navigate(`/ride/${ride.uid}/${ride.id}`)}
             >
                <div>
                   <div style={{fontWeight: 'bold', marginBottom: '4px'}}>
                      {new Date(ride.date).toLocaleDateString()}
                   </div>
                   <div style={{color: 'var(--text-muted)', fontSize: '14px', display: 'flex', gap: '12px'}}>
                     <span><strong>{formatTime(ride.duration)}</strong></span>
                     <span><strong>{ride.distance}</strong> km</span>
                   </div>
                </div>
                <ChevronRight color="var(--text-muted)" />
             </div>
          ))}
          {myRides.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)'}}>You haven't recorded any rides yet.</div>}
       </div>
    </div>
  );
}
