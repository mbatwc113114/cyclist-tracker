import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Activity, Target, ChevronRight, Flame, Trophy, Users, Globe, Calendar } from 'lucide-react';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

import { useData } from '../contexts/DataContext';
import { Haptics } from '../utils/haptics';
import { calculateStreak } from '../utils/streak';

export default function Feed({ user }) {
  const { usersDict, allRides, isInitializing } = useData();
  const [myRides, setMyRides] = useState([]);
  const [streak, setStreak] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [clubMembers, setClubMembers] = useState({});
  const [clubGoal, setClubGoal] = useState(null);
  const [clubGoalProgress, setClubGoalProgress] = useState(0);
  
  // Leaderboard Filters
  const [timeFilter, setTimeFilter] = useState('today'); // today, week, month, year, all
  const [scopeFilter, setScopeFilter] = useState('global'); // global, club
  const [scopeInitialized, setScopeInitialized] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);

  const navigate = useNavigate();

  // 1. Set User Profile from Context
  useEffect(() => {
    if (user && usersDict && usersDict[user.uid]) {
      setUserProfile(usersDict[user.uid]);
    }
  }, [user, usersDict]);

  // 2. Fetch Club Members if in a club
  const [clubName, setClubName] = useState('');
  useEffect(() => {
    if (userProfile && userProfile.clubId) {
       const clubRef = ref(database, `clubs/${userProfile.clubId}`);
       const unsubscribe = onValue(clubRef, (snapshot) => {
          if (snapshot.exists()) {
             const clubData = snapshot.val();
             setClubName(clubData.name);
             if (clubData.members) setClubMembers(clubData.members);
             if (clubData.targetDistance > 0) {
                setClubGoal({ distance: clubData.targetDistance, type: clubData.targetType || 'monthly' });
             } else {
                setClubGoal(null);
             }
          }
       });
       
       if (!scopeInitialized) {
         setScopeFilter('club');
         setScopeInitialized(true);
       }
       
       return () => unsubscribe();
    } else {
       setClubName('');
       setClubMembers({});
    }
  }, [userProfile, scopeInitialized]);

  // 3. Calculate Club Goal Progress
  useEffect(() => {
     if (clubGoal && Object.keys(clubMembers).length > 0 && allRides.length > 0) {
        let ridesForTarget = allRides.filter(r => clubMembers[r.uid]);
        const now = Date.now();
        const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
        const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;

        if (clubGoal.type === 'weekly') {
           ridesForTarget = ridesForTarget.filter(r => r.date >= oneWeekAgo);
        } else if (clubGoal.type === 'monthly') {
           ridesForTarget = ridesForTarget.filter(r => r.date >= oneMonthAgo);
        }

        const totalDist = ridesForTarget.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);
        const percent = Math.min((totalDist / clubGoal.distance) * 100, 100);
        setClubGoalProgress(percent);
     }
  }, [clubGoal, clubMembers, allRides]);


  // 4. Extract my rides for heatmap
  useEffect(() => {
    if (user && allRides.length > 0) {
      const myR = allRides.filter(r => r.uid === user.uid).sort((a,b) => b.date - a.date);
      setMyRides(myR);
      setStreak(calculateStreak(myR));
    }
  }, [user, allRides]);

  // 5. Calculate Leaderboard
  useEffect(() => {
    let filteredRides = allRides;

    // Time Filter
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - (now.getDay() * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

    if (timeFilter === 'today') filteredRides = filteredRides.filter(r => r.date >= startOfToday);
    else if (timeFilter === 'week') filteredRides = filteredRides.filter(r => r.date >= startOfWeek);
    else if (timeFilter === 'month') filteredRides = filteredRides.filter(r => r.date >= startOfMonth);
    else if (timeFilter === 'year') filteredRides = filteredRides.filter(r => r.date >= startOfYear);

    // Scope Filter
    if (scopeFilter === 'club' && userProfile?.clubId) {
      filteredRides = filteredRides.filter(r => clubMembers[r.uid]);
    }

    // Aggregate by User
    const userTotals = {};
    filteredRides.forEach(ride => {
       if (!userTotals[ride.uid]) {
          userTotals[ride.uid] = { 
             uid: ride.uid, 
             distance: 0, 
             name: ride.userName || usersDict[ride.uid]?.displayName || 'Unknown Cyclist',
             photo: ride.userPhoto || usersDict[ride.uid]?.photoURL
          };
       }
       userTotals[ride.uid].distance += parseFloat(ride.distance || 0);
    });

    const sortedBoard = Object.values(userTotals).sort((a, b) => b.distance - a.distance);
    setLeaderboard(sortedBoard);
  }, [allRides, timeFilter, scopeFilter, clubMembers, userProfile, usersDict]);

  // 6. Heatmap Logic (Distance & Goal)
  const [heatmapData, setHeatmapData] = useState([]);
  const [heatmapTimeFilter, setHeatmapTimeFilter] = useState('3m');
  const [heatmapStartDate, setHeatmapStartDate] = useState(new Date());

  useEffect(() => {
    const today = new Date();
    let start = new Date(today);
    if (heatmapTimeFilter === '3m') {
       start.setMonth(start.getMonth() - 3);
    } else if (heatmapTimeFilter === '6m') {
       start.setMonth(start.getMonth() - 6);
    } else {
       start.setFullYear(start.getFullYear() - 1);
    }
    setHeatmapStartDate(start);
  }, [heatmapTimeFilter]);
  
  useEffect(() => {
    if (!myRides || myRides.length === 0) return;
    const dailyDistances = {};
    myRides.forEach(r => {
      const d = new Date(r.date);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!dailyDistances[dateStr]) dailyDistances[dateStr] = 0;
      dailyDistances[dateStr] += parseFloat(r.distance || 0);
    });

    const goal = userProfile?.dailyGoal || 10;
    const hData = Object.keys(dailyDistances).map(dateStr => {
      const dist = dailyDistances[dateStr];
      let colorClass = 'color-empty';
      if (dist > 0 && dist < goal) colorClass = 'color-orange';
      else if (dist >= goal && dist < goal * 1.5) colorClass = 'color-green';
      else if (dist >= goal * 1.5) colorClass = 'color-gold';
      
      return { date: dateStr, count: dist, colorClass };
    });
    setHeatmapData(hData);
  }, [myRides, userProfile]);

  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayDistance = myRides.filter(r => r.date >= todayStart).reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);
  const dailyGoal = userProfile?.dailyGoal || 10;
  const progressPercent = Math.min((todayDistance / dailyGoal) * 100, 100);

  const recentRides = myRides.slice(0, 1);

  const formatTime = (seconds) => {
    if (!seconds) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px', padding: 'var(--space-md)'}}>
      
      {/* User Stats Snapshot */}
      {user && (
         <div style={{display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)'}}>
            <div className="card" style={{flex: 1, padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
               <Flame color="var(--activity-calories)" size={32} style={{marginBottom: 'var(--space-sm)'}} />
               <div className="text-h2" style={{margin: 0}}>{streak}</div>
               <div className="text-caption" style={{color: 'var(--text-muted)'}}>Day Streak</div>
            </div>
            <div className="card" style={{flex: 1, padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
               <Activity color="var(--primary-main)" size={32} style={{marginBottom: 'var(--space-sm)'}} />
               <div className="text-h2" style={{margin: 0}}>{myRides.length}</div>
               <div className="text-caption" style={{color: 'var(--text-muted)'}}>Total Rides</div>
            </div>
         </div>
      )}

      {/* Daily Goal Progress */}
      {user && (
         <div className="card" style={{marginBottom: 'var(--space-lg)', padding: 'var(--space-lg)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)'}}>
               <h4 className="text-h4" style={{margin: 0}}>Daily Goal Progress</h4>
               <span style={{fontWeight: 700, color: 'var(--primary-main)'}}>{Math.round(progressPercent)}%</span>
            </div>
            <div style={{width: '100%', height: '12px', background: 'var(--surface-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden'}}>
               <div style={{width: `${progressPercent}%`, height: '100%', background: 'var(--primary-main)', borderRadius: 'var(--radius-pill)', transition: 'width 0.5s ease'}}></div>
            </div>
            <div className="text-caption" style={{color: 'var(--text-muted)', marginTop: 'var(--space-sm)', textAlign: 'right'}}>
               {todayDistance.toFixed(1)} / {dailyGoal} km
            </div>
         </div>
      )}

      {/* Club Goal Progress */}
      {userProfile?.clubId && clubGoal && (
         <div className="card" style={{marginBottom: 'var(--space-lg)', padding: 'var(--space-lg)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)'}}>
               <h4 className="text-h4" style={{margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
                  <Target size={16} color="var(--primary-main)" />
                  Club Goal ({clubGoal.type})
               </h4>
               <span style={{fontWeight: 700, color: 'var(--primary-main)'}}>{clubGoalProgress.toFixed(1)}%</span>
            </div>
            <div style={{width: '100%', height: '12px', background: 'var(--surface-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden'}}>
               <div style={{width: `${clubGoalProgress}%`, height: '100%', background: 'var(--primary-main)', borderRadius: 'var(--radius-pill)', transition: 'width 0.5s ease'}}></div>
            </div>
         </div>
      )}

      {/* Heatmap */}
      {user && myRides.length > 0 && (
         <div className="card" style={{marginBottom: 'var(--space-lg)', padding: 'var(--space-lg)'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)'}}>
               <h4 className="text-h4" style={{margin: 0}}>Activity Heatmap</h4>
               <select 
                  className="input-field"
                  value={heatmapTimeFilter} 
                  onChange={(e) => { Haptics.light(); setHeatmapTimeFilter(e.target.value); }}
                  style={{padding: '4px 8px', height: 'auto', width: 'auto', fontSize: '12px'}}
               >
                  <option value="3m">Last 3 Months</option>
                  <option value="6m">Last 6 Months</option>
                  <option value="1y">Last Year</option>
               </select>
            </div>
            <div style={{background: 'var(--surface-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-card)', color: 'var(--text-primary)'}}>
              <CalendarHeatmap
                 startDate={heatmapStartDate}
                 endDate={new Date()}
                 values={heatmapData}
                 classForValue={(value) => {
                   if (!value || value.count === 0) return 'color-empty';
                   return value.colorClass;
                 }}
                 tooltipDataAttrs={(value) => {
                    return { 'data-tooltip-id': 'heatmap-tooltip', 'data-tooltip-content': value && value.count ? `${value.count.toFixed(1)} km on ${value.date}` : '0 km' };
                 }}
               />
               <style>{`
                 .react-calendar-heatmap .color-empty { fill: rgba(255, 255, 255, 0.05); }
                 .react-calendar-heatmap .color-orange { fill: #F97316; }
                 .react-calendar-heatmap .color-green { fill: #22C55E; }
                 .react-calendar-heatmap .color-gold { fill: #EAB308; }
                 .react-calendar-heatmap text { fill: var(--text-muted); font-size: 10px; }
               `}</style>
            </div>
         </div>
      )}

      {/* Recent Activity Feed */}
      <h2 className="text-h2" style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-xxxl)', marginBottom: 'var(--space-md)'}}>
         <Activity color="var(--primary-main)"/> 
         Your Latest Ride
      </h2>
      <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)'}}>
         {recentRides.map(ride => (
            <div key={ride.id} className="card" style={{padding: '0', overflow: 'hidden', cursor: 'pointer'}} onClick={() => { Haptics.light(); navigate(`/ride/${ride.uid}/${ride.id}`); }}>
               {/* User Info Header */}
               <div style={{padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-md)'}}>
                  {ride.userPhoto || usersDict[ride.uid]?.photoURL ? (
                     <img src={ride.userPhoto || usersDict[ride.uid]?.photoURL} alt="User" style={{width: '40px', height: '40px', borderRadius: '50%', border: '2px solid var(--primary-main)'}} referrerPolicy="no-referrer" />
                  ) : (
                     <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                        {(ride.userName || usersDict[ride.uid]?.displayName || 'U')[0].toUpperCase()}
                     </div>
                  )}
                  <div>
                     <div className="text-body" style={{fontWeight: 700}}>{ride.userName || usersDict[ride.uid]?.displayName || 'Cyclist'}</div>
                     <div className="text-caption" style={{color: 'var(--text-muted)'}}>
                        {ride.title || new Date(ride.date).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                     </div>
                  </div>
               </div>
               
               {/* Map Preview */}
               {ride.route && ride.route.length > 0 && (
                  <div style={{height: '250px', width: '100%', background: 'var(--bg-app)', pointerEvents: 'none'}}>
                     <MapContainer center={ride.route[Math.floor(ride.route.length/2)]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false}>
                        <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
                        <Polyline positions={ride.route} color="var(--primary-main)" weight={5} opacity={0.8} />
                     </MapContainer>
                  </div>
               )}

               {/* Stats Footer */}
               <div style={{padding: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)', alignItems: 'center', background: 'var(--surface-input)'}}>
                  <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                     <div className="text-label" style={{textTransform: 'uppercase'}}>Distance</div>
                     <div className="text-h3" style={{color: 'var(--activity-distance)'}}>{ride.distance} km</div>
                  </div>
                  <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                     <div className="text-label" style={{textTransform: 'uppercase'}}>Time</div>
                     <div className="text-h3" style={{color: 'var(--text-primary)'}}>{formatTime(ride.duration)}</div>
                  </div>
                  {ride.averageSpeed && (
                     <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                        <div className="text-label" style={{textTransform: 'uppercase'}}>Avg Speed</div>
                        <div className="text-h3" style={{color: 'var(--activity-speed)'}}>{ride.averageSpeed} km/h</div>
                     </div>
                  )}
                  {ride.elevationGain && (
                     <div style={{flex: '1 1 auto', minWidth: '80px'}}>
                        <div className="text-label" style={{textTransform: 'uppercase'}}>Elevation</div>
                        <div className="text-h3" style={{color: 'var(--activity-elevation)'}}>{ride.elevationGain} m</div>
                     </div>
                  )}
               </div>
            </div>
         ))}
         {recentRides.length === 0 && <div className="text-body" style={{color: 'var(--text-muted)', textAlign: 'center'}}>No recent activity. Start your first ride!</div>}
      </div>

      {/* LEADERBOARDS SECTION */}
      <h2 className="text-h2" style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginTop: 'var(--space-xxxl)', marginBottom: 'var(--space-md)'}}>
         <Trophy color="var(--primary-main)"/> 
         {scopeFilter === 'club' && clubName ? `${clubName} Leaderboard` : 'Leaderboards'}
      </h2>
      
      {/* Club Joining Prompt */}
      {userProfile && !userProfile.clubId && (
         <div className="card" style={{marginBottom: 'var(--space-lg)', padding: 'var(--space-xl)', textAlign: 'center', border: '1px solid var(--primary-main)'}}>
            <h3 className="text-h3" style={{margin: '0 0 var(--space-sm) 0'}}>Compete with Friends!</h3>
            <p className="text-body" style={{color: 'var(--text-muted)', marginBottom: 'var(--space-lg)'}}>Join a club to unlock private leaderboards and ride with your friends.</p>
            <button onClick={() => { Haptics.light(); navigate('/clubs'); }} className="btn btn-primary" style={{padding: '12px 24px'}}>Find a Club</button>
         </div>
      )}

      {/* Leaderboard Controls */}
      <div className="card" style={{marginBottom: 'var(--space-lg)', padding: 'var(--space-md)'}}>
         <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-md)'}}>
            {/* Scope Toggle */}
            <div style={{display: 'flex', background: 'var(--surface-input)', borderRadius: 'var(--radius-pill)', padding: '4px'}}>
               <button 
                  className="btn"
                  onClick={() => { Haptics.light(); setScopeFilter('global'); }}
                  style={{background: scopeFilter === 'global' ? 'var(--surface-card-elevated)' : 'transparent', color: scopeFilter === 'global' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: scopeFilter === 'global' ? 'var(--shadow-card)' : 'none'}}
               ><Globe size={16}/> Global</button>
               
               {userProfile?.clubId && (
                  <button 
                     className="btn"
                     onClick={() => { Haptics.light(); setScopeFilter('club'); }}
                     style={{background: scopeFilter === 'club' ? 'var(--surface-card-elevated)' : 'transparent', color: scopeFilter === 'club' ? 'var(--text-primary)' : 'var(--text-muted)', border: 'none', padding: '6px 12px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: scopeFilter === 'club' ? 'var(--shadow-card)' : 'none'}}
                  ><Users size={16}/> Club</button>
               )}
            </div>
         </div>

         {/* Time Filters */}
         <div style={{display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', paddingBottom: '4px'}}>
            {['today', 'week', 'month', 'year', 'all'].map(t => (
               <button 
                  key={t}
                  className="btn"
                  onClick={() => { Haptics.light(); setTimeFilter(t); }}
                  style={{
                     background: timeFilter === t ? 'var(--primary-main)' : 'var(--surface-input)',
                     color: timeFilter === t ? 'white' : 'var(--text-muted)',
                     border: 'none', padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap', height: 'auto'
                  }}
               >
                  {t === 'all' ? 'All-Time' : t}
               </button>
            ))}
         </div>
      </div>

      {/* Leaderboard List */}
      <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)'}}>
        {leaderboard.map((u, index) => (
           <div key={u.uid} className="card" style={{padding: 'var(--space-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: index === 0 ? '4px solid var(--primary-main)' : '4px solid transparent', cursor: 'pointer'}} onClick={() => { Haptics.light(); navigate(`/user/${u.uid}`); }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-md)'}}>
                 <div style={{fontWeight: 700, color: index === 0 ? 'var(--primary-main)' : 'var(--text-muted)', width: '24px'}}>#{index + 1}</div>
                 {u.photo ? (
                    <img src={u.photo} alt="User" style={{width: '40px', height: '40px', borderRadius: '50%'}} referrerPolicy="no-referrer" />
                 ) : (
                    <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                       {u.name[0].toUpperCase()}
                    </div>
                 )}
                 <div className="text-body" style={{fontWeight: 700}}>{u.name} {u.uid === user.uid && <span className="text-caption" style={{color: 'var(--primary-main)', marginLeft: '4px'}}>(You)</span>}</div>
              </div>
              <div className="text-h3" style={{fontFamily: 'monospace'}}>
                 {u.distance.toFixed(1)} <span className="text-caption" style={{color: 'var(--text-muted)'}}>km</span>
              </div>
           </div>
        ))}
        {leaderboard.length === 0 && <div className="text-body" style={{textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0'}}>No riders found for this filter.</div>}
      </div>

    </div>
  );
}
