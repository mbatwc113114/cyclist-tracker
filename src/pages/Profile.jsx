import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';
import { User, Activity, MapPin, ChevronRight, TrendingUp, Settings, Trash2, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { calculateStreak } from '../utils/streak';
import { Haptics } from '../utils/haptics';
import { PerformanceAnalytics } from '../utils/PerformanceAnalytics';

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
    Haptics.success();
    import('firebase/database').then(({ update, ref: dbRef }) => {
       update(dbRef(database, `users/${user.uid}`), { dailyGoal: parseFloat(goalInput) || 10 });
    });
  };

  const handleLeaveClub = () => {
    if (!stats.clubId) return;
    Haptics.warning();
    import('firebase/database').then(({ update, ref: dbRef }) => {
       const updates = {};
       updates[`users/${user.uid}/clubId`] = null;
       updates[`clubs/${stats.clubId}/members/${user.uid}`] = null;
       update(dbRef(database), updates);
    });
  };

  const handleSaveProfile = () => {
    Haptics.success();
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
      Haptics.warning();
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
  const currentStreak = calculateStreak(myRides);

  const personalRecords = PerformanceAnalytics.calculatePersonalRecords(myRides);
  const goalProgress = PerformanceAnalytics.calculateGoalProgress(myRides, stats.dailyGoal || goalInput || 10);

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px'}}>
       
       <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: 'var(--space-lg)', marginTop: 'var(--space-md)'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', overflow: 'hidden'}}>
                {stats.photoURL || user?.photoURL ? (
                   <img src={stats.photoURL || user.photoURL} alt="User" style={{width: '64px', height: '64px', borderRadius: '50%', border: '2px solid var(--primary-main)'}} referrerPolicy="no-referrer" />
                ) : (
                   <div style={{width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <User size={32} color="white" />
                   </div>
                )}
                <div style={{overflow: 'hidden'}}>
                   <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                     <h2 className="text-h2" style={{margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>
                        {stats.displayName || user?.displayName || 'Anonymous Cyclist'}
                     </h2>
                     {currentStreak > 0 && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--activity-calories)', fontWeight: 'bold', fontSize: '14px'}}>
                           <Flame size={16} fill="currentColor" />
                           {currentStreak}
                        </div>
                     )}
                   </div>
                   <div className="text-body-small" style={{color: 'var(--text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{user?.email}</div>
                   {stats.age && <div className="text-caption" style={{color: 'var(--text-muted)'}}>{stats.age} years old</div>}
                </div>
             </div>
             <div style={{display: 'flex', gap: '8px'}}>
                <button onClick={() => { Haptics.light(); setIsEditing(!isEditing); }} className="btn btn-secondary" style={{padding: '6px 12px', fontSize: '13px', height: 'auto'}}>
                   {isEditing ? 'Cancel' : 'Edit'}
                </button>
                <button onClick={() => { Haptics.light(); navigate('/settings'); }} className="btn" style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '8px'}}>
                   <Settings size={24} />
                </button>
             </div>
          </div>
          
          {isEditing && (
             <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-sm)', background: 'var(--surface-input)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-card)'}}>
                <div>
                   <div className="text-label" style={{marginBottom: '4px'}}>Display Name</div>
                   <input type="text" className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} style={{width: '100%'}} />
                </div>
                <div>
                   <div className="text-label" style={{marginBottom: '4px'}}>Profile Image URL</div>
                   <input type="text" className="input-field" value={editPhoto} onChange={(e) => setEditPhoto(e.target.value)} placeholder="https://..." style={{width: '100%'}} />
                </div>
                <div>
                   <div className="text-label" style={{marginBottom: '4px'}}>Age</div>
                   <input type="number" className="input-field" value={editAge} onChange={(e) => setEditAge(e.target.value)} style={{width: '100%'}} />
                </div>
                <button onClick={handleSaveProfile} className="btn btn-primary" style={{marginTop: '8px'}}>Save Profile</button>
             </div>
          )}
       </div>

       <div className="card" style={{textAlign: 'center', padding: 'var(--space-xxl) var(--space-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 'var(--space-lg)'}}>
          <div style={{display: 'flex', gap: 'var(--space-xxxl)'}}>
             <div style={{textAlign: 'center'}}>
                <div className="text-large-number">{calculatedTotalDistance.toFixed(1)}</div>
                <div className="text-label">Total Km</div>
             </div>
             <div style={{textAlign: 'center'}}>
                <div className="text-large-number">{myRides.length}</div>
                <div className="text-label">Rides</div>
             </div>
          </div>
          
          {stats.clubId && (
             <div style={{marginTop: 'var(--space-xxl)', width: '100%', background: 'var(--surface-input)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{textAlign: 'left'}}>
                   <div className="text-label">Current Club</div>
                   <div className="text-body" style={{fontWeight: 700}}>{clubName || 'Loading...'}</div>
                </div>
                <button onClick={handleLeaveClub} className="btn btn-danger" style={{padding: '6px 12px', height: 'auto', fontSize: '13px'}}>Leave Club</button>
             </div>
           )}

          <div style={{marginTop: 'var(--space-lg)', width: '100%', background: 'var(--surface-input)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-card)'}}>
             <div className="text-label" style={{marginBottom: 'var(--space-sm)'}}>Daily Distance Goal (km)</div>
             <div style={{display: 'flex', gap: 'var(--space-sm)'}}>
                <input 
                   type="number" 
                   className="input-field"
                   value={goalInput} 
                   onChange={(e) => setGoalInput(e.target.value)} 
                   style={{flex: 1}}
                />
                <button onClick={handleSaveGoal} className="btn btn-primary" style={{padding: '8px 16px', height: 'auto'}}>Save</button>
             </div>
          </div>
       </div>

       {/* Goal Progress */}
       {goalProgress && (
          <div className="card" style={{marginTop: 'var(--space-lg)', padding: 'var(--space-lg)'}}>
             <h3 className="text-h3" style={{marginBottom: 'var(--space-lg)'}}>Goal Progress</h3>
             <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-md)'}}>
                <div>
                   <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)'}}>
                      <span className="text-label">Today</span>
                      <span className="text-caption">{goalProgress.daily.current} / {goalProgress.daily.target} km</span>
                   </div>
                   <div style={{width: '100%', height: '8px', background: 'var(--surface-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden'}}>
                      <div style={{width: `${goalProgress.daily.percent}%`, height: '100%', background: 'var(--activity-distance)', borderRadius: 'var(--radius-pill)', transition: 'width 0.3s ease'}}></div>
                   </div>
                </div>
                <div>
                   <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)'}}>
                      <span className="text-label">This Week</span>
                      <span className="text-caption">{goalProgress.weekly.current} / {goalProgress.weekly.target} km</span>
                   </div>
                   <div style={{width: '100%', height: '8px', background: 'var(--surface-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden'}}>
                      <div style={{width: `${goalProgress.weekly.percent}%`, height: '100%', background: 'var(--activity-cycling)', borderRadius: 'var(--radius-pill)', transition: 'width 0.3s ease'}}></div>
                   </div>
                </div>
                <div>
                   <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-xs)'}}>
                      <span className="text-label">This Month</span>
                      <span className="text-caption">{goalProgress.monthly.current} / {goalProgress.monthly.target} km</span>
                   </div>
                   <div style={{width: '100%', height: '8px', background: 'var(--surface-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden'}}>
                      <div style={{width: `${goalProgress.monthly.percent}%`, height: '100%', background: 'var(--primary-main)', borderRadius: 'var(--radius-pill)', transition: 'width 0.3s ease'}}></div>
                   </div>
                </div>
             </div>
          </div>
       )}

       {/* Personal Records */}
       {personalRecords && (
          <div className="card" style={{marginTop: 'var(--space-lg)', padding: 'var(--space-lg)'}}>
             <h3 className="text-h3" style={{marginBottom: 'var(--space-lg)'}}>Personal Records</h3>
             <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)'}}>
                <div style={{background: 'var(--surface-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)'}}>
                   <div className="text-label" style={{marginBottom: '4px'}}>Longest Ride</div>
                   <div className="text-h3" style={{color: 'var(--activity-distance)'}}>{personalRecords.longestDistance} <span className="text-body-small">km</span></div>
                </div>
                <div style={{background: 'var(--surface-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)'}}>
                   <div className="text-label" style={{marginBottom: '4px'}}>Highest Speed</div>
                   <div className="text-h3" style={{color: 'var(--activity-speed)'}}>{personalRecords.highestSpeed} <span className="text-body-small">km/h</span></div>
                </div>
                <div style={{background: 'var(--surface-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)'}}>
                   <div className="text-label" style={{marginBottom: '4px'}}>Highest Elev</div>
                   <div className="text-h3" style={{color: 'var(--activity-elevation)'}}>{personalRecords.highestElevation} <span className="text-body-small">m</span></div>
                </div>
                <div style={{background: 'var(--surface-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)'}}>
                   <div className="text-label" style={{marginBottom: '4px'}}>Longest Time</div>
                   <div className="text-h3" style={{color: 'var(--text-primary)'}}>{personalRecords.longestRideTime}</div>
                </div>
             </div>
          </div>
       )}

       {/* Advanced Analysis Chart */}
       {myRides.length > 0 && (
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

       <div style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-xxl)', marginBottom: 'var(--space-lg)', gap: 'var(--space-md)'}}>
         <h3 className="text-h3" style={{margin: 0}}>My Recent Rides</h3>
         <div style={{display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', paddingBottom: '4px'}}>
            {['today', 'week', 'month', 'year', 'all'].map(t => (
               <button 
                  key={t}
                  className="btn"
                  onClick={() => { Haptics.light(); setRideTimeFilter(t); }}
                  style={{
                     background: rideTimeFilter === t ? 'var(--primary-main)' : 'var(--surface-input)',
                     color: rideTimeFilter === t ? 'white' : 'var(--text-muted)',
                     border: 'none', padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', height: '32px'
                  }}
               >
                  {t === 'all' ? 'All' : t}
               </button>
            ))}
         </div>
       </div>
       <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-md)'}}>
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
                  className="card" 
                  style={{padding: '0', overflow: 'hidden', cursor: 'pointer', position: 'relative'}} 
                  onClick={() => { Haptics.light(); navigate(`/ride/${ride.uid}/${ride.id}`); }}
                >
                   <button 
                     className="btn btn-secondary"
                     onClick={(e) => handleDeleteRide(ride, e)} 
                     style={{position: 'absolute', top: '16px', right: '16px', color: 'var(--semantic-error)', padding: '8px', borderRadius: '50%', zIndex: 10, width: '36px', height: '36px'}}
                   >
                      <Trash2 size={18} />
                   </button>

                   <div style={{padding: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: '12px'}}>
                      <div className="text-body" style={{fontWeight: 700}}>
                         {ride.title || new Date(ride.date).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                   </div>
                   
                   {ride.route && ride.route.length > 0 ? (
                      <div style={{height: '250px', width: '100%', background: 'var(--bg-app)', pointerEvents: 'none'}}>
                         <MapContainer center={ride.route[Math.floor(ride.route.length/2)]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false}>
                            <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                            <Polyline positions={ride.route} color="var(--primary-main)" weight={5} opacity={0.8} />
                         </MapContainer>
                      </div>
                   ) : (
                      <div style={{height: '100px', width: '100%', background: 'var(--bg-app)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)'}}>
                         No GPS Data
                      </div>
                   )}

                   <div style={{padding: 'var(--space-lg)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-lg)', alignItems: 'center', background: 'var(--surface-input)'}}>
                      <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                         <div className="text-label">Distance</div>
                         <div className="text-h3" style={{color: 'var(--activity-distance)'}}>{ride.distance} km</div>
                      </div>
                      <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                         <div className="text-label">Time</div>
                         <div className="text-h3" style={{color: 'var(--text-primary)'}}>{formatTime(ride.duration)}</div>
                      </div>
                      {ride.averageSpeed && (
                         <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                            <div className="text-label">Avg Speed</div>
                            <div className="text-h3" style={{color: 'var(--activity-speed)'}}>{ride.averageSpeed} km/h</div>
                         </div>
                      )}
                      {ride.elevationGain && (
                         <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                            <div className="text-label">Elevation</div>
                            <div className="text-h3" style={{color: 'var(--activity-elevation)'}}>{ride.elevationGain} m</div>
                         </div>
                      )}
                   </div>
                </div>
              ));
           })()}
          {myRides.length === 0 && <div className="text-body" style={{textAlign: 'center', color: 'var(--text-muted)'}}>You haven't recorded any rides yet.</div>}
       </div>
    </div>
  );
}
