import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue, push, set, update } from 'firebase/database';
import { Users, Plus } from 'lucide-react';
import { Haptics } from '../utils/haptics';

export default function Clubs({ user }) {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState([]);
  const [newClubName, setNewClubName] = useState('');
  const [checkingClub, setCheckingClub] = useState(true);

  useEffect(() => {
    // Check if user is already in a club
    const userRef = ref(database, `users/${user.uid}/clubId`);
    const unsubscribeUser = onValue(userRef, (snapshot) => {
       if (snapshot.exists() && snapshot.val()) {
          navigate(`/club/${snapshot.val()}`, { replace: true });
       } else {
          setCheckingClub(false);
       }
    });

    const clubsRef = ref(database, 'clubs');
    const unsubscribeClubs = onValue(clubsRef, (snapshot) => {
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

    return () => {
       unsubscribeUser();
       unsubscribeClubs();
    };
  }, [user.uid, navigate]);

  if (checkingClub) {
     return (
       <div className="page-enter-active" style={{padding: 'var(--space-xxl)', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
         <div className="skeleton" style={{width: '100%', height: '150px', borderRadius: 'var(--radius-card)'}}></div>
       </div>
     );
  }

  const handleCreateClub = async (e) => {
    e.preventDefault();
    if (!newClubName.trim()) return;
    
    Haptics.success();
    const clubsRef = ref(database, 'clubs');
    const newClubRef = push(clubsRef);
    await set(newClubRef, {
      name: newClubName,
      createdBy: user.uid,
      members: { [user.uid]: true },
      createdAt: Date.now()
    });
    await update(ref(database, `users/${user.uid}`), { clubId: newClubRef.key });
    setNewClubName('');
  };

  const handleJoinClub = async (clubId) => {
    Haptics.success();
    await update(ref(database, `users/${user.uid}`), { clubId: clubId });
    await update(ref(database, `clubs/${clubId}/members`), { [user.uid]: true });
  };

  return (
    <div className="page-enter-active">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xxl)'}}>
        <h2 className="text-display">Riding Clubs</h2>
      </div>

      <div className="card" style={{marginBottom: 'var(--space-xxxl)'}}>
        <h3 className="text-h3" style={{marginBottom: 'var(--space-lg)'}}>Start a New Club</h3>
        <form onSubmit={handleCreateClub} style={{display: 'flex', gap: 'var(--space-md)'}}>
          <input 
            type="text" 
            className="input-field"
            placeholder="Club Name" 
            value={newClubName}
            onChange={(e) => setNewClubName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" style={{whiteSpace: 'nowrap'}}>
            <Plus size={18} strokeWidth={2.5} /> Create
          </button>
        </form>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-xxl)'}}>
        {clubs.map(club => (
          <div 
             key={club.id} 
             className="card" 
             style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', cursor: 'pointer', padding: 'var(--space-lg)'}}
             onClick={() => { Haptics.light(); navigate(`/club/${club.id}`); }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-md)'}}>
              {club.photoURL ? (
                 <img src={club.photoURL} alt="Club" style={{width: '52px', height: '52px', borderRadius: 'var(--radius-pill)', border: '2px solid var(--primary-main)'}} />
              ) : (
                 <div style={{background: 'var(--primary-main)', padding: '14px', borderRadius: 'var(--radius-pill)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                   <Users size={24} color="white" strokeWidth={1.8} />
                 </div>
              )}
              <div style={{flex: 1, overflow: 'hidden'}}>
                <h3 className="text-h3" style={{margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{club.name}</h3>
                <span className="text-body-small" style={{color: 'var(--text-muted)'}}>{club.members ? Object.keys(club.members).length : 0} Members</span>
              </div>
            </div>
            {club.members && club.members[user.uid] ? (
               <button disabled className="btn btn-secondary" style={{marginTop: 'auto', width: '100%'}}>
                 Joined
               </button>
            ) : (
               <button 
                  onClick={(e) => { e.stopPropagation(); handleJoinClub(club.id); }} 
                  className="btn btn-primary" 
                  style={{marginTop: 'auto', width: '100%'}}
               >
                 Join Club
               </button>
            )}
          </div>
        ))}
        {clubs.length === 0 && (
          <p className="text-body" style={{color: 'var(--text-muted)'}}>No clubs found. Be the first to create one!</p>
        )}
      </div>
    </div>
  );
}
