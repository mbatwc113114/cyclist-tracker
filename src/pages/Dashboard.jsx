import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Flame, Activity, Bike, Play, Calendar, Trophy, ChevronRight } from 'lucide-react';
import { PerformanceAnalytics } from '../utils/PerformanceAnalytics';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import { Haptics } from '../utils/haptics';
import { calculateStreak } from '../utils/streak';

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [pastRides, setPastRides] = useState([]);
  const [streak, setStreak] = useState(0);
  const [timeframe, setTimeframe] = useState('30_days'); // 'today', '7_days', '30_days', 'year', 'all_time'
  
  // Fetch past rides and calculate streak
  useEffect(() => {
    const ridesRef = ref(database, `rides/${user.uid}`);
    const unsubscribe = onValue(ridesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const rideList = Object.keys(data).map(key => ({id: key, ...data[key]})).sort((a,b) => b.date - a.date);
        setPastRides(rideList);
        setStreak(calculateStreak(rideList));
      } else {
        setPastRides([]);
      }
    });
    return () => unsubscribe();
  }, [user.uid]);

  const handleTimeframeChange = (tf) => {
    Haptics.light();
    setTimeframe(tf);
  };

  const handleStartRide = () => {
    Haptics.medium();
    navigate('/record');
  };

  // Analytics Processing
  const filteredRides = PerformanceAnalytics.getRidesInPeriod(pastRides, timeframe);
  const overview = PerformanceAnalytics.calculateOverview(filteredRides);
  const weeklyData = PerformanceAnalytics.getWeeklyChartData(pastRides);
  const monthlyData = PerformanceAnalytics.getMonthlyChartData(pastRides);

  return (
    <div className="page-enter-active" style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-xxl)'}}>
      
      {/* Header & Streak */}
      <div className="card" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-lg)'}}>
          {user.photoURL ? (
            <img src={user.photoURL} alt="Profile" style={{width: '52px', height: '52px', borderRadius: 'var(--radius-pill)', border: '2px solid var(--primary-main)'}} referrerPolicy="no-referrer" />
          ) : (
            <div style={{width: '52px', height: '52px', borderRadius: 'var(--radius-pill)', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold'}}>
              {user.displayName ? user.displayName[0].toUpperCase() : 'C'}
            </div>
          )}
          <div>
            <h2 className="text-h3" style={{margin: 0}}>Hello, {user.displayName?.split(' ')[0] || 'Cyclist'}!</h2>
            <p className="text-body-small" style={{color: 'var(--text-tertiary)', margin: 0}}>Ready for your next ride?</p>
          </div>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)'}}>
          <Flame size={24} color="var(--activity-calories)" />
          <div>
            <div className="text-h2" style={{lineHeight: 1}}>{streak} <span className="text-caption" style={{color: 'var(--text-muted)', fontWeight: 'normal'}}>Days</span></div>
          </div>
        </div>
      </div>

      {/* Primary Action Button (Start Ride) */}
      <button className="btn btn-primary" onClick={handleStartRide} style={{width: '100%', height: '56px', fontSize: '16px', boxShadow: '0 8px 24px rgba(99,102,241,0.25)'}}>
        <Play size={22} fill="currentColor" /> Start New Ride
      </button>

      {/* Analytics Timeframe Selector */}
      <div style={{display: 'flex', gap: 'var(--space-sm)', overflowX: 'auto', paddingBottom: 'var(--space-sm)', scrollbarWidth: 'none'}}>
        {[
          { id: 'today', label: 'Today' },
          { id: '7_days', label: 'Week' },
          { id: '30_days', label: 'Month' },
          { id: 'year', label: 'Year' },
          { id: 'all_time', label: 'All Time' }
        ].map(tf => (
          <button 
            key={tf.id}
            onClick={() => handleTimeframeChange(tf.id)}
            className="btn"
            style={{
              background: timeframe === tf.id ? 'var(--primary-main)' : 'var(--surface-input)',
              color: timeframe === tf.id ? '#FFFFFF' : 'var(--text-muted)',
              border: '1px solid ' + (timeframe === tf.id ? 'var(--primary-main)' : 'var(--border-subtle)'),
              borderRadius: 'var(--radius-pill)', 
              padding: '6px 14px', 
              fontSize: '13px',
              fontWeight: 600, 
              whiteSpace: 'nowrap',
              height: '32px'
            }}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Overview Cards */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)'}}>
         <div className="card" style={{padding: 'var(--space-lg)'}}>
            <div className="text-label" style={{marginBottom: 'var(--space-xs)'}}>Distance</div>
            <div className="text-large-number">{overview.totalDistance} <span className="text-body" style={{color: 'var(--text-muted)'}}>km</span></div>
         </div>
         <div className="card" style={{padding: 'var(--space-lg)'}}>
            <div className="text-label" style={{marginBottom: 'var(--space-xs)'}}>Moving Time</div>
            <div className="text-h2" style={{marginTop: 'var(--space-sm)', fontVariantNumeric: 'tabular-nums'}}>{PerformanceAnalytics.formatDuration(overview.movingTime)}</div>
         </div>
         <div className="card" style={{padding: 'var(--space-lg)'}}>
            <div className="text-label" style={{marginBottom: 'var(--space-xs)'}}>Avg Speed</div>
            <div className="text-h2" style={{marginTop: 'var(--space-sm)', fontVariantNumeric: 'tabular-nums'}}>{overview.averageSpeed} <span className="text-body" style={{color: 'var(--text-muted)'}}>km/h</span></div>
         </div>
         <div className="card" style={{padding: 'var(--space-lg)'}}>
            <div className="text-label" style={{marginBottom: 'var(--space-xs)'}}>Elevation</div>
            <div className="text-h2" style={{marginTop: 'var(--space-sm)', fontVariantNumeric: 'tabular-nums'}}>{overview.elevationGain} <span className="text-body" style={{color: 'var(--text-muted)'}}>m</span></div>
         </div>
      </div>

      {/* Weekly Chart */}
      <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)'}}>
           <Activity size={20} color="var(--activity-cycling)" strokeWidth={2} />
           <h3 className="text-h3" style={{margin: 0}}>Weekly Volume</h3>
        </div>
        <div style={{width: '100%', height: '200px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
              <Tooltip 
                 contentStyle={{background: 'var(--surface-card-elevated)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)'}}
                 itemStyle={{color: 'var(--activity-cycling)', fontWeight: 'bold'}}
              />
              <Bar dataKey="distance" fill="var(--activity-cycling)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="card" style={{display: 'flex', flexDirection: 'column'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)'}}>
           <Calendar size={20} color="var(--primary-main)" strokeWidth={2} />
           <h3 className="text-h3" style={{margin: 0}}>Monthly Distance</h3>
        </div>
        <div style={{width: '100%', height: '200px'}}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="colorDistance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary-main)" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="var(--primary-main)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{fill: 'var(--text-muted)', fontSize: 11}} axisLine={false} tickLine={false} />
              <Tooltip 
                 contentStyle={{background: 'var(--surface-card-elevated)', border: '1px solid var(--border-normal)', borderRadius: 'var(--radius-sm)'}}
                 itemStyle={{color: 'var(--primary-main)', fontWeight: 'bold'}}
              />
              <Area type="monotone" dataKey="distance" stroke="var(--primary-main)" strokeWidth={3} fillOpacity={1} fill="url(#colorDistance)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="card">
         <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)'}}>
            <Trophy size={22} color="var(--activity-speed)" strokeWidth={2} />
            <h3 className="text-h3" style={{margin: 0}}>Recent Rides</h3>
         </div>
         <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-md)'}}>
            {pastRides.slice(0, 5).map(ride => (
               <div onClick={() => navigate(`/ride/${ride.id}`)} key={ride.id} className="btn" style={{width: '100%', padding: 'var(--space-lg)', background: 'var(--surface-card-elevated)', borderRadius: 'var(--radius-button)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left'}}>
                  <div style={{flex: 1}}>
                     <div className="text-body" style={{fontWeight: 600, marginBottom: 'var(--space-xs)'}}>
                        {ride.title || `${new Date(ride.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} Ride`}
                     </div>
                     <div className="text-caption" style={{color: 'var(--text-tertiary)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)'}}>
                       <span><strong style={{color: 'var(--text-secondary)'}}>{PerformanceAnalytics.formatDuration(ride.movingTime || ride.duration || 0)}</strong> Time</span>
                       <span><strong style={{color: 'var(--text-secondary)'}}>{ride.distance}</strong> km</span>
                       {ride.elevationGain && <span><strong style={{color: 'var(--text-secondary)'}}>{ride.elevationGain}</strong> m Elev</span>}
                     </div>
                  </div>
                  <div style={{color: 'var(--text-disabled)', marginLeft: 'var(--space-md)'}}>
                     <ChevronRight size={20} />
                  </div>
               </div>
            ))}
            {pastRides.length === 0 && <div className="text-body" style={{color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xxl) 0'}}>No past rides found. Start riding!</div>}
         </div>
      </div>

    </div>
  );
}
