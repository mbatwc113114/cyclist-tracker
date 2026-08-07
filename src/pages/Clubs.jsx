import React, { useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { Users, Plus } from 'lucide-react';

export default function Clubs({ user }) {
  const [clubs, setClubs] = useState([]);
  const [newClubName, setNewClubName] = useState('');

  useEffect(() => {
    const clubsRef = ref(database, 'clubs');
    const unsubscribe = onValue(clubsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const clubList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setClubs(clubList);
      } else {
        setClubs([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!newClubName.trim()) return;
    
    const clubsRef = ref(database, 'clubs');
    const newClubRef = push(clubsRef);
    await set(newClubRef, {
      name: newClubName,
      createdBy: user.uid,
      members: { [user.uid]: true },
      memberCount: 1,
      createdAt: Date.now()
    });
    setNewClubName('');
  };

  return (
    <div className="page-enter-active">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'}}>
        <h2>Riding Clubs</h2>
      </div>

      <div className="glass-panel" style={{marginBottom: '32px'}}>
        <h3 style={{marginBottom: '16px'}}>Start a New Club</h3>
        <form onSubmit={handleCreateClub} style={{display: 'flex', gap: '12px'}}>
          <input 
            type="text" 
            placeholder="Club Name" 
            value={newClubName}
            onChange={(e) => setNewClubName(e.target.value)}
          />
          <button type="submit" className="btn-primary" style={{whiteSpace: 'nowrap'}}>
            <Plus size={18} /> Create Club
          </button>
        </form>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px'}}>
        {clubs.map(club => (
          <div key={club.id} className="glass-panel" style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
              <div style={{background: 'var(--primary-color)', padding: '12px', borderRadius: '50%'}}>
                <Users size={24} color="white" />
              </div>
              <div>
                <h3 style={{margin: 0}}>{club.name}</h3>
                <span style={{fontSize: '14px', color: 'var(--text-muted)'}}>{club.memberCount} Members</span>
              </div>
            </div>
            <button className="btn-secondary" style={{marginTop: 'auto', width: '100%'}}>
              View Leaderboard
            </button>
          </div>
        ))}
        {clubs.length === 0 && (
          <p style={{color: 'var(--text-muted)'}}>No clubs found. Be the first to create one!</p>
        )}
      </div>
    </div>
  );
}
