import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue } from 'firebase/database';
import { Trophy } from 'lucide-react';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    const usersRef = ref(database, 'users');
    const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const users = Object.keys(data).map(uid => ({
          uid,
          ...data[uid]
        })).sort((a, b) => (b.totalDistance || 0) - (a.totalDistance || 0));
        setLeaders(users);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px'}}>
      <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px'}}>
         <Trophy size={28} color="gold" />
         <h2 style={{margin: 0}}>Global Leaderboard</h2>
      </div>

      <div className="glass-panel" style={{padding: '0', overflow: 'hidden'}}>
        {leaders.map((u, index) => (
           <div key={u.uid} style={{display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--border-color)', background: index === 0 ? 'rgba(255, 215, 0, 0.1)' : 'transparent'}}>
              
              <div style={{width: '30px', fontWeight: 'bold', color: index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? '#cd7f32' : 'var(--text-muted)'}}>
                 #{index + 1}
              </div>

              {u.photoURL ? (
                 <img src={u.photoURL} alt="Profile" style={{width: '40px', height: '40px', borderRadius: '50%', marginRight: '16px'}} referrerPolicy="no-referrer" />
              ) : (
                 <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', marginRight: '16px'}}>
                    {u.displayName ? u.displayName[0].toUpperCase() : 'U'}
                 </div>
              )}

              <div style={{flex: 1}}>
                 <div style={{fontWeight: 'bold'}}>{u.displayName}</div>
                 <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>All-time Distance</div>
              </div>

              <div style={{fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'monospace'}}>
                 {Number(u.totalDistance || 0).toFixed(1)} <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>km</span>
              </div>

           </div>
        ))}
      </div>
    </div>
  );
}
