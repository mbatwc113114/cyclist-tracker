import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Activity, Target, ChevronRight, Flame, Trophy, Users, Globe, Calendar } from 'lucide-react';
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';

export default function Feed({ user }) {
  const [allRides, setAllRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [streak, setStreak] = useState(0);
  const [userProfile, setUserProfile] = useState(null);
  const [clubMembers, setClubMembers] = useState({});
  const [usersDict, setUsersDict] = useState({});
  
  // Leaderboard Filters
  const [timeFilter, setTimeFilter] = useState('all'); // today, week, month, year, all
  const [scopeFilter, setScopeFilter] = useState('global'); // global, club
  const [leaderboard, setLeaderboard] = useState([]);

  const navigate = useNavigate();

  // 1. Fetch Users & Profile
  useEffect(() => {
    if (!user) return;
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUsersDict(data);
        setUserProfile(data[user.uid]);
      }
    });
    return () => unsubscribe();
  }, [user]);

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
          }
       });
       return () => unsubscribe();
    } else {
       setClubName('');
       setClubMembers({});
    }
  }, [userProfile]);

  // 3. Fetch All Rides
  useEffect(() => {
    const ridesRef = ref(database, 'rides');
    const unsubscribe = onValue(ridesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let rides = [];
        Object.keys(data).forEach(uid => {
          Object.keys(data[uid]).forEach(rideId => {
            rides.push({ id: rideId, uid: uid, ...data[uid][rideId] });
          });
        });
        setAllRides(rides);
      } else {
        setAllRides([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 4. Extract my rides for heatmap
  useEffect(() => {
    if (user && allRides.length > 0) {
      const myR = allRides.filter(r => r.uid === user.uid).sort((a,b) => b.date - a.date);
      setMyRides(myR);

      let currentStreak = 0;
      let lastDate = new Date();
      lastDate.setHours(0,0,0,0);
      let uniqueDays = [...new Set(myR.map(r => new Date(r.date).setHours(0,0,0,0)))];
      
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

      {/* Daily Goal Progress */}
      {user && (
         <div className="glass-panel" style={{marginBottom: '24px', padding: '20px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
               <h4 style={{margin: 0}}>Daily Goal Progress</h4>
               <span style={{fontWeight: 'bold', color: 'var(--accent-color)'}}>{Math.round(progressPercent)}%</span>
            </div>
            <div style={{width: '100%', height: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', overflow: 'hidden'}}>
               <div style={{width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-color), var(--accent-color))', borderRadius: '6px', transition: 'width 0.5s ease'}}></div>
            </div>
            <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right'}}>
               {todayDistance.toFixed(1)} / {dailyGoal} km
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
                   if (!value || value.count === 0) return 'color-empty';
                   return value.colorClass;
                 }}
                 tooltipDataAttrs={(value) => {
                    return { 'data-tooltip-id': 'heatmap-tooltip', 'data-tooltip-content': value && value.count ? `${value.count.toFixed(1)} km on ${value.date}` : '0 km' };
                 }}
               />
            </div>
         </div>
      )}

      {/* LEADERBOARDS SECTION */}
      <h2 style={{display: 'flex', alignItems: 'center', gap: '8px', marginTop: '32px'}}>
         <Trophy color="var(--accent-color)"/> 
         {scopeFilter === 'club' && clubName ? `${clubName} Leaderboard` : 'Leaderboards'}
      </h2>
      
      {/* Club Joining Prompt */}
      {userProfile && !userProfile.clubId && (
         <div className="glass-panel" style={{marginBottom: '24px', padding: '24px', textAlign: 'center', border: '1px solid var(--accent-color)'}}>
            <h3 style={{margin: '0 0 8px 0'}}>Compete with Friends!</h3>
            <p style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '16px'}}>Join a club to unlock private leaderboards and ride with your friends.</p>
            <button onClick={() => navigate('/clubs')} style={{background: 'var(--primary-color)', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>Find a Club</button>
         </div>
      )}

      {/* Leaderboard Controls */}
      <div className="glass-panel" style={{marginBottom: '24px', padding: '16px'}}>
         <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px'}}>
            {/* Scope Toggle */}
            <div style={{display: 'flex', background: 'var(--bg-dark)', borderRadius: '8px', padding: '4px'}}>
               <button 
                  onClick={() => setScopeFilter('global')}
                  style={{background: scopeFilter === 'global' ? 'var(--bg-panel)' : 'transparent', color: scopeFilter === 'global' ? 'white' : 'var(--text-muted)', border: 'none', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s'}}
               ><Globe size={16}/> Global</button>
               
               {userProfile?.clubId && (
                  <button 
                     onClick={() => setScopeFilter('club')}
                     style={{background: scopeFilter === 'club' ? 'var(--bg-panel)' : 'transparent', color: scopeFilter === 'club' ? 'white' : 'var(--text-muted)', border: 'none', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s'}}
                  ><Users size={16}/> Club</button>
               )}
            </div>
         </div>

         {/* Time Filters */}
         <div style={{display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px'}}>
            {['today', 'week', 'month', 'year', 'all'].map(t => (
               <button 
                  key={t}
                  onClick={() => setTimeFilter(t)}
                  style={{
                     background: timeFilter === t ? 'var(--primary-color)' : 'var(--bg-dark)',
                     color: timeFilter === t ? 'white' : 'var(--text-muted)',
                     border: 'none', padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap'
                  }}
               >
                  {t === 'all' ? 'All-Time' : t}
               </button>
            ))}
         </div>
      </div>

      {/* Leaderboard List */}
      <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
        {leaderboard.map((u, index) => (
           <div key={u.uid} className="glass-panel" style={{padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: index === 0 ? '4px solid var(--accent-color)' : '4px solid transparent'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
                 <div style={{fontWeight: 'bold', color: index === 0 ? 'var(--accent-color)' : 'var(--text-muted)', width: '24px'}}>#{index + 1}</div>
                 {u.photo ? (
                    <img src={u.photo} alt="User" style={{width: '40px', height: '40px', borderRadius: '50%'}} referrerPolicy="no-referrer" />
                 ) : (
                    <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                       {u.name[0].toUpperCase()}
                    </div>
                 )}
                 <div style={{fontWeight: 'bold'}}>{u.name} {u.uid === user.uid && <span style={{fontSize: '12px', color: 'var(--primary-color)', marginLeft: '4px'}}>(You)</span>}</div>
              </div>
              <div style={{fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'monospace'}}>
                 {u.distance.toFixed(1)} <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>km</span>
              </div>
           </div>
        ))}
        {leaderboard.length === 0 && <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0'}}>No riders found for this filter.</div>}
      </div>

    </div>
  );
}
