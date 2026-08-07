import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Activity, Target, ChevronRight, Flame } from 'lucide-react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

export default function Feed({ user }) {
  const [feed, setFeed] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [streak, setStreak] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const ridesRef = ref(database, 'rides');
    const unsubscribe = onValue(ridesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let allRides = [];
        Object.keys(data).forEach(uid => {
          const userRides = data[uid];
          Object.keys(userRides).forEach(rideId => {
            allRides.push({ id: rideId, uid: uid, ...userRides[rideId] });
          });
        });
        allRides.sort((a,b) => b.date - a.date);
        setFeed(allRides);
      } else {
        setFeed([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch my rides for Heatmap & Streak
  useEffect(() => {
    if (!user) return;
    const ridesRef = ref(database, `rides/${user.uid}`);
    const unsubscribe = onValue(ridesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let rides = Object.keys(data).map(key => ({id: key, ...data[key]}));
        rides.sort((a,b) => b.date - a.date);
        setMyRides(rides);

        let currentStreak = 0;
        let lastDate = new Date();
        lastDate.setHours(0,0,0,0);
        let uniqueDays = [...new Set(rides.map(r => new Date(r.date).setHours(0,0,0,0)))];
        
        for (let i = 0; i < uniqueDays.length; i++) {
           const d = uniqueDays[i];
           const diff = Math.floor((lastDate - d) / (1000 * 60 * 60 * 24));
           if (diff === 0 || diff === 1) { 
              currentStreak++;
              lastDate = new Date(d);
           } else {
              break;
           }
        }
        setStreak(currentStreak);
      } else {
        setMyRides([]);
        setStreak(0);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const heatmapData = myRides.map(r => {
    const d = new Date(r.date);
    return { date: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, count: 1 };
  });

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px'}}>
      
      {/* User Stats Snapshot */}
      {user && (
         <div style={{display: 'flex', gap: '16px', marginBottom: '24px'}}>
            <div className="glass-panel" style={{flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
               <Flame color="var(--accent-color)" size={32} style={{marginBottom: '8px'}} />
               <div style={{fontSize: '24px', fontWeight: 'bold'}}>{streak}</div>
               <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Day Streak</div>
            </div>
            <div className="glass-panel" style={{flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
               <Activity color="var(--primary-color)" size={32} style={{marginBottom: '8px'}} />
               <div style={{fontSize: '24px', fontWeight: 'bold'}}>{myRides.length}</div>
               <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Total Rides</div>
            </div>
         </div>
      )}

      {/* Heatmap */}
      {user && myRides.length > 0 && (
         <div className="glass-panel" style={{marginBottom: '24px', padding: '20px'}}>
            <h4 style={{marginTop: 0, marginBottom: '16px'}}>Activity Heatmap</h4>
            <div style={{background: 'rgba(255,255,255,0.9)', padding: '12px', borderRadius: '8px', color: 'black'}}>
              <CalendarHeatmap
                 startDate={new Date(new Date().setFullYear(new Date().getFullYear() - 1))}
                 endDate={new Date()}
                 values={heatmapData}
                 classForValue={(value) => {
                   if (!value) return 'color-empty';
                   return `color-scale-4`;
                 }}
               />
            </div>
         </div>
      )}

      {/* Challenges Section */}
      <div className="glass-panel" style={{marginBottom: '24px'}}>
         <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px'}}>
            <Target color="var(--primary-color)"/> 
            <h3 style={{margin: 0}}>Monthly Challenges</h3>
         </div>
         <div style={{background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
            <div style={{fontWeight: 'bold'}}>August 100km Challenge</div>
            <div style={{fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px'}}>Ride 100km this month.</div>
            <div style={{width: '100%', background: 'rgba(0,0,0,0.5)', height: '8px', borderRadius: '4px', overflow: 'hidden'}}>
               <div style={{width: '45%', background: 'var(--primary-color)', height: '100%'}}></div>
            </div>
            <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'right'}}>45km / 100km</div>
         </div>
      </div>

      <h2 style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: 0}}><Activity color="var(--primary-color)"/> Global Feed</h2>
      
      <div style={{display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px'}}>
        {feed.map(ride => (
           <div 
             key={ride.id} 
             className="glass-panel" 
             style={{padding: '20px', cursor: 'pointer', position: 'relative'}}
             onClick={() => navigate(`/ride/${ride.uid}/${ride.id}`)}
           >
              <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}>
                 {ride.userPhoto ? (
                    <img src={ride.userPhoto} alt="User" style={{width: '40px', height: '40px', borderRadius: '50%'}} referrerPolicy="no-referrer" />
                 ) : (
                    <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                       {ride.userName ? ride.userName[0].toUpperCase() : 'U'}
                    </div>
                 )}
                 <div>
                    <div style={{fontWeight: 'bold'}}>{ride.userName || 'Anonymous Cyclist'}</div>
                    <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>
                       {new Date(ride.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                 </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px'}}>
                 <div>
                    <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Distance</div>
                    <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{ride.distance} km</div>
                 </div>
                 <div>
                    <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>Time</div>
                    <div style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{formatTime(ride.duration)}</div>
                 </div>
              </div>

              <div style={{position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)'}}>
                 <ChevronRight color="var(--text-muted)" />
              </div>
           </div>
        ))}
        {feed.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)'}}>No rides found.</div>}
      </div>
    </div>
  );
}
