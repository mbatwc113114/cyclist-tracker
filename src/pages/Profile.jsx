import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { User, Activity, MapPin, ChevronRight, TrendingUp, Settings, Trash2 } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function RouteBounds({ route }) {
  const map = useMap();
  useEffect(() => {
    if (route && route.length > 0) {
      map.fitBounds(route, { padding: [5, 5] });
    }
  }, [route, map]);
  return null;
}

export default function Profile({ user }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalDistance: 0, totalTime: 0, dailyGoal: 10 });
  const [myRides, setMyRides] = useState([]);
  const [goalInput, setGoalInput] = useState('');
  const [clubName, setClubName] = useState('');
  const [rideTimeFilter, setRideTimeFilter] = useState('today');

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editAge, setEditAge] = useState('');

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
    const cachedUser = localStorage.getItem('cache_profile_user');
    if (cachedUser) {
      try {
        const data = JSON.parse(cachedUser);
        setStats(data);
        setGoalInput(data.dailyGoal || 10);
      } catch(e) {}
    }

    const userRef = ref(database, `users/${user.uid}`);
    onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
         const data = snapshot.val();
         setStats(data);
         setGoalInput(data.dailyGoal || 10);
         if (!isEditing) {
            setEditName(data.displayName || user.displayName || '');
            setEditPhoto(data.photoURL || user.photoURL || '');
            setEditAge(data.age || '');
         }
         try { localStorage.setItem('cache_profile_user', JSON.stringify(data)); } catch(e){}
      }
    });

    const cachedRides = localStorage.getItem('cache_profile_rides');
    if (cachedRides) {
      try { setMyRides(JSON.parse(cachedRides)); } catch(e) {}
    }

    const ridesRef = ref(database, `rides/${user.uid}`);
    onValue(ridesRef, (snapshot) => {
      if (snapshot.exists()) {
         const data = snapshot.val();
         const rideList = Object.keys(data)
            .map(key => ({id: key, uid: user.uid, ...data[key]}))
            .filter(r => !r.isCustomRoute)
            .sort((a,b) => b.date - a.date);
         setMyRides(rideList);
         try { localStorage.setItem('cache_profile_rides', JSON.stringify(rideList)); } catch(e){}
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

  const handleSaveProfile = () => {
    import('firebase/database').then(({ update, ref: dbRef }) => {
       update(dbRef(database, `users/${user.uid}`), {
          displayName: editName,
          photoURL: editPhoto,
          age: editAge
       });
       setIsEditing(false);
    });
  };

  const handleDeleteRide = (ride, e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this ride?")) {
      import('firebase/database').then(({ remove, update, ref: dbRef }) => {
         remove(dbRef(database, `rides/${user.uid}/${ride.id}`));
         update(dbRef(database, `users/${user.uid}`), {
            totalDistance: Math.max(0, (stats.totalDistance || 0) - parseFloat(ride.distance || 0)),
            totalTime: Math.max(0, (stats.totalTime || 0) - parseFloat(ride.duration || 0))
         });
      });
    }
  };

  const chartData = myRides.slice(0, 10).reverse().map((r) => ({
    distance: parseFloat(r.distance),
    date: new Date(r.date).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})
  }));

  const calculatedTotalDistance = myRides.reduce((acc, ride) => acc + (parseFloat(ride.distance) || 0), 0);

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px'}}>
       
       <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', marginTop: '16px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden'}}>
                {stats.photoURL || user?.photoURL ? (
                   <img src={stats.photoURL || user.photoURL} alt="User" style={{width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--primary-color)'}} referrerPolicy="no-referrer" />
                ) : (
                   <div style={{width: '60px', height: '60px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <User size={32} color="white" />
                   </div>
                )}
                <div style={{overflow: 'hidden'}}>
                   <h2 style={{margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>
                      {stats.displayName || user?.displayName || 'Anonymous Cyclist'}
                   </h2>
                   <div style={{color: 'var(--text-muted)', fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{user?.email}</div>
                   {stats.age && <div style={{color: 'var(--text-muted)', fontSize: '12px'}}>{stats.age} years old</div>}
                </div>
             </div>
             <div style={{display: 'flex', gap: '8px'}}>
                <button onClick={() => setIsEditing(!isEditing)} className="btn-secondary" style={{padding: '6px 12px', fontSize: '12px'}}>
                   {isEditing ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={() => navigate('/settings')} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px'}}>
                   <Settings size={24} />
                </button>
             </div>
          </div>
          
          {isEditing && (
             <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px'}}>
                <div>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>Display Name</div>
                   <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white'}} />
                </div>
                <div>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>Profile Image URL</div>
                   <input type="text" value={editPhoto} onChange={(e) => setEditPhoto(e.target.value)} placeholder="https://..." style={{width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white'}} />
                </div>
                <div>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>Age</div>
                   <input type="number" value={editAge} onChange={(e) => setEditAge(e.target.value)} style={{width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white'}} />
                </div>
                <button onClick={handleSaveProfile} className="btn-primary" style={{marginTop: '8px'}}>Save Profile</button>
             </div>
          )}
       </div>

       <div className="glass-panel" style={{textAlign: 'center', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '16px'}}>
          <div style={{display: 'flex', gap: '24px'}}>
             <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '24px', fontWeight: 'bold'}}>{calculatedTotalDistance.toFixed(1)}</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Total Km</div>
             </div>
             <div style={{textAlign: 'center'}}>
                <div style={{fontSize: '24px', fontWeight: 'bold'}}>{myRides.length}</div>
                <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Rides</div>
             </div>
          </div>
          
          {stats.clubId && (
             <div style={{marginTop: '24px', width: '100%', background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{textAlign: 'left'}}>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Current Club</div>
                   <div style={{fontWeight: 'bold'}}>{clubName || 'Loading...'}</div>
                </div>
                <button onClick={handleLeaveClub} className="btn-secondary" style={{color: 'var(--danger-color)', borderColor: 'var(--danger-color)', padding: '6px 12px'}}>Leave Club</button>
             </div>
           )}

          <div style={{marginTop: '16px', width: '100%', background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px'}}>
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
          <div className="glass-panel" style={{marginTop: '16px', padding: '16px'}}>
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

       <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', marginBottom: '16px', gap: '16px'}}>
         <h3 style={{margin: 0}}>My Recent Rides</h3>
         <div style={{display: 'flex', gap: '8px', overflowX: 'auto'}}>
            {['today', 'week', 'month', 'year', 'all'].map(t => (
               <button 
                  key={t}
                  onClick={() => setRideTimeFilter(t)}
                  style={{
                     background: rideTimeFilter === t ? 'var(--primary-color)' : 'var(--bg-dark)',
                     color: rideTimeFilter === t ? 'white' : 'var(--text-muted)',
                     border: 'none', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'capitalize'
                  }}
               >
                  {t === 'all' ? 'All' : t}
               </button>
            ))}
         </div>
       </div>
       <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
           {(() => {
              let filteredRides = myRides;
              const now = new Date();
              const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
              const startOfWeek = startOfToday - (now.getDay() * 24 * 60 * 60 * 1000);
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
              const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

              if (rideTimeFilter === 'today') filteredRides = myRides.filter(r => r.date >= startOfToday);
              else if (rideTimeFilter === 'week') filteredRides = myRides.filter(r => r.date >= startOfWeek);
              else if (rideTimeFilter === 'month') filteredRides = myRides.filter(r => r.date >= startOfMonth);
              else if (rideTimeFilter === 'year') filteredRides = myRides.filter(r => r.date >= startOfYear);

              return filteredRides.map(ride => (
                <div 
                  key={ride.id} 
                  className="glass-panel" 
                  style={{padding: '0', overflow: 'hidden', cursor: 'pointer', position: 'relative'}} 
                  onClick={() => navigate(`/ride/${ride.uid}/${ride.id}`)}
                >
                   <button 
                     onClick={(e) => handleDeleteRide(ride, e)} 
                     style={{position: 'absolute', top: '16px', right: '16px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'var(--danger-color)', padding: '8px', borderRadius: '50%', cursor: 'pointer', zIndex: 10}}
                   >
                      <Trash2 size={20} />
                   </button>

                   <div style={{padding: '16px', display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <div style={{fontWeight: 'bold', marginBottom: '4px', fontSize: '14px'}}>
                         {ride.title || new Date(ride.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                   </div>
                   
                   {ride.route && ride.route.length > 0 ? (
                      <div style={{height: '250px', width: '100%', background: 'var(--bg-dark)', pointerEvents: 'none'}}>
                         <MapContainer center={ride.route[Math.floor(ride.route.length/2)]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false}>
                            <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                            <Polyline positions={ride.route} color="#FC4C02" weight={4} opacity={0.8} />
                         </MapContainer>
                      </div>
                   ) : (
                      <div style={{height: '100px', width: '100%', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
                         No GPS Data
                      </div>
                   )}

                   <div style={{padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', background: 'rgba(0,0,0,0.2)'}}>
                      <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                         <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Distance</div>
                         <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{ride.distance} km</div>
                      </div>
                      <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                         <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Time</div>
                         <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{formatTime(ride.duration)}</div>
                      </div>
                      {ride.averageSpeed && (
                         <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                            <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Avg Speed</div>
                            <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{ride.averageSpeed} km/h</div>
                         </div>
                      )}
                      {ride.elevationGain && (
                         <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                            <div style={{fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Elevation</div>
                            <div style={{fontSize: '1.2rem', fontWeight: 'bold'}}>{ride.elevationGain} m</div>
                         </div>
                      )}
                   </div>
                </div>
              ));
           })()}
          {myRides.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)'}}>You haven't recorded any rides yet.</div>}
       </div>
    </div>
  );
}
