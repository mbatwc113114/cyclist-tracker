import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { Users, ArrowLeft, Settings, User, Activity, Share, QrCode, Target, Flame } from 'lucide-react';
import { calculateStreak } from '../utils/streak';
import { createPortal } from 'react-dom';

export default function ClubDetail({ user: currentUser }) {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [members, setMembers] = useState([]);
  const [clubRides, setClubRides] = useState([]);
  const [activityFilter, setActivityFilter] = useState('today'); // all, today, week, month
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editTargetDistance, setEditTargetDistance] = useState('');
  const [editTargetType, setEditTargetType] = useState('monthly');
  
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const clubRef = ref(database, `clubs/${clubId}`);
    const unsubscribe = onValue(clubRef, async (snapshot) => {
      if (snapshot.exists()) {
         const data = snapshot.val();
         setClub({ id: clubId, ...data });
         if (!isEditing) {
            setEditName(data.name || '');
            setEditPhoto(data.photoURL || '');
            setEditTargetDistance(data.targetDistance || '');
            setEditTargetType(data.targetType || 'monthly');
         }

         if (data.members) {
            const memberIds = Object.keys(data.members);
            const memberDetails = [];
            const allRides = [];

            for (const mId of memberIds) {
               const uSnap = await get(ref(database, `users/${mId}`));
               let mName = 'Unknown User';
               let mPhoto = null;

               // Fetch rides for this member to compute streak and feed
               const rSnap = await get(ref(database, `rides/${mId}`));
               let memberRidesList = [];
               if (rSnap.exists()) {
                  const rData = rSnap.val();
                  Object.keys(rData).forEach(rKey => {
                     if (!rData[rKey].isCustomRoute) {
                        const rideObj = {
                           id: rKey,
                           uid: mId,
                           userName: mName,
                           userPhoto: mPhoto,
                           ...rData[rKey]
                        };
                        allRides.push(rideObj);
                        memberRidesList.push(rideObj);
                     }
                  });
               }

               if (uSnap.exists()) {
                  const uData = uSnap.val();
                  mName = uData.displayName || mName;
                  mPhoto = uData.photoURL;
                  memberDetails.push({ uid: mId, streak: calculateStreak(memberRidesList), ...uData });
               } else {
                  memberDetails.push({ uid: mId, displayName: mName, streak: calculateStreak(memberRidesList) });
               }
            setMembers(memberDetails);
            setClubRides(allRides.sort((a,b) => b.date - a.date)); 
         } else {
            setMembers([]);
            setClubRides([]);
         }
      } else {
         setClub(null);
      }
    });

    return () => unsubscribe();
  }, [clubId]);

  const handleSaveClub = () => {
     import('firebase/database').then(({ update, ref: dbRef }) => {
        update(dbRef(database, `clubs/${clubId}`), {
           name: editName,
           photoURL: editPhoto,
           targetDistance: Number(editTargetDistance) || 0,
           targetType: editTargetType
        });
        setIsEditing(false);
     });
  };

  const handleJoinClub = async () => {
    await update(ref(database, `users/${currentUser.uid}`), { clubId: clubId });
    await update(ref(database, `clubs/${clubId}/members`), { [currentUser.uid]: true });
  };

  const handleLeaveClub = async () => {
    if (window.confirm("Are you sure you want to leave this club?")) {
       await update(ref(database, `users/${currentUser.uid}`), { clubId: null });
       await update(ref(database, `clubs/${clubId}/members/${currentUser.uid}`), null);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const getShareUrl = () => {
     return `https://cyclist-tracker-ochre.vercel.app/club/${clubId}`;
  };

  const handleShare = async () => {
     const url = getShareUrl();
     const text = `Join my cycling club ${club.name} on K-Flow Ride!`;
     
     if (navigator.share) {
        try {
           await navigator.share({
              title: 'Join my Cycling Club',
              text: text,
              url: url
           });
        } catch (err) {
           console.log('Error sharing:', err);
        }
     } else {
        navigator.clipboard.writeText(`${text} ${url}`);
        alert('Invite link copied to clipboard!');
     }
  };

  if (club === null) {
     return <div className="page-enter-active" style={{padding: '20px'}}>Loading club...</div>;
  }

  const isAdmin = club.createdBy === currentUser.uid;
  const isMember = club.members && club.members[currentUser.uid];

  // Filtering Logic
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneWeekAgo = today - 7 * 24 * 60 * 60 * 1000;
  const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).getTime();

  let filteredRides = clubRides;
  if (activityFilter === 'today') {
     filteredRides = clubRides.filter(r => r.date >= today);
  } else if (activityFilter === 'week') {
     filteredRides = clubRides.filter(r => r.date >= oneWeekAgo);
  } else if (activityFilter === 'month') {
     filteredRides = clubRides.filter(r => r.date >= oneMonthAgo);
  }

  // Calculate Progress against Target
  let targetProgress = 0;
  if (club.targetDistance > 0) {
      let ridesForTarget = clubRides;
      if (club.targetType === 'weekly') {
         ridesForTarget = clubRides.filter(r => r.date >= oneWeekAgo);
      } else if (club.targetType === 'monthly') {
         ridesForTarget = clubRides.filter(r => r.date >= oneMonthAgo);
      }
      
      const totalDist = ridesForTarget.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);
      targetProgress = Math.min((totalDist / club.targetDistance) * 100, 100);
  }

  return (
    <div className="page-enter-active" style={{paddingBottom: '80px', padding: '20px'}}>
       
       <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px'}}>
         <button onClick={() => navigate(-1)} style={{background: 'var(--bg-panel)', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex'}}>
            <ArrowLeft size={24} />
         </button>
         <h1 style={{margin: 0}}>Club Detail</h1>
       </div>

       {club.targetDistance > 0 && (
          <div className="glass-panel" style={{padding: '16px', marginBottom: '24px'}}>
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-color)'}}>
                   <Target size={20} />
                   <h4 style={{margin: 0}}>Club Goal ({club.targetType})</h4>
                </div>
                <div style={{fontSize: '14px', fontWeight: 'bold'}}>{club.targetDistance} km</div>
             </div>
             <div style={{height: '12px', background: 'var(--bg-inset)', borderRadius: '6px', overflow: 'hidden'}}>
                <div style={{height: '100%', width: `${targetProgress}%`, background: 'var(--primary-color)', transition: 'width 0.5s ease-out'}} />
             </div>
             <div style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'right'}}>
                {targetProgress.toFixed(1)}% Completed
             </div>
          </div>
       )}

       <div className="glass-panel" style={{display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: '16px', overflow: 'hidden'}}>
                {club.photoURL ? (
                   <img src={club.photoURL} alt="Club DP" style={{width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--primary-color)', objectFit: 'cover'}} />
                ) : (
                   <div style={{width: '72px', height: '72px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Users size={40} color="white" />
                   </div>
                )}
                <div style={{overflow: 'hidden'}}>
                   <h2 style={{margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{club.name}</h2>
                   <div style={{color: 'var(--text-muted)', fontSize: '14px'}}>{members.length} Members</div>
                </div>
             </div>
             <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                <button onClick={() => setShowQR(true)} style={{background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: '8px'}}>
                   <QrCode size={24} />
                </button>
                <button onClick={handleShare} style={{background: 'transparent', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', padding: '8px'}}>
                   <Share size={24} />
                </button>
                {isAdmin && (
                   <button onClick={() => setIsEditing(!isEditing)} style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px'}}>
                      <Settings size={28} />
                   </button>
                )}
             </div>
          </div>
          
          {isEditing && isAdmin && (
             <div style={{display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px', background: 'var(--bg-inset)', padding: '16px', borderRadius: '8px'}}>
                <div>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>Club Name</div>
                   <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white'}} />
                </div>
                <div>
                   <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>Club Display Photo (URL)</div>
                   <input type="text" value={editPhoto} onChange={(e) => setEditPhoto(e.target.value)} placeholder="https://..." style={{width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white'}} />
                </div>
                <div style={{display: 'flex', gap: '12px'}}>
                   <div style={{flex: 1}}>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>Target Distance (km)</div>
                      <input type="number" value={editTargetDistance} onChange={(e) => setEditTargetDistance(e.target.value)} placeholder="e.g. 500" style={{width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white'}} />
                   </div>
                   <div style={{flex: 1}}>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px'}}>Target Type</div>
                      <select value={editTargetType} onChange={(e) => setEditTargetType(e.target.value)} style={{width: '100%', padding: '8px', borderRadius: '6px', background: 'var(--bg-dark)', border: '1px solid var(--border-color)', color: 'white'}}>
                         <option value="weekly">Weekly</option>
                         <option value="monthly">Monthly</option>
                      </select>
                   </div>
                </div>
                <button onClick={handleSaveClub} className="btn-primary" style={{marginTop: '8px'}}>Save Changes</button>
             </div>
          )}

          {!isEditing && (
             <div style={{marginTop: '8px'}}>
                {isMember ? (
                   <button onClick={handleLeaveClub} className="btn-secondary" style={{width: '100%', color: 'var(--danger-color)', borderColor: 'var(--danger-color)'}}>Leave Club</button>
                ) : (
                   <button onClick={handleJoinClub} className="btn-primary" style={{width: '100%'}}>Join Club</button>
                )}
             </div>
          )}
       </div>

       <h3 style={{marginTop: '32px', marginBottom: '16px'}}>Members</h3>
       <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px', marginBottom: '32px'}}>
           {members.map(member => (
             <div 
               key={member.uid} 
               className="glass-panel" 
               style={{padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textAlign: 'center'}} 
               onClick={() => navigate(`/user/${member.uid}`)}
             >
                {member.photoURL ? (
                   <img src={member.photoURL} alt="User" style={{width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover'}} referrerPolicy="no-referrer" />
                ) : (
                   <div style={{width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <User size={24} color="white" />
                   </div>
                )}
                <div style={{fontSize: '14px', fontWeight: 'bold', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%'}}>
                   {member.displayName || 'Anonymous'}
                </div>
                {member.streak > 0 && (
                   <div style={{display: 'flex', alignItems: 'center', gap: '2px', color: '#ff9800', fontWeight: 'bold', fontSize: '12px'}}>
                      <Flame size={14} fill="#ff9800" />
                      {member.streak}
                   </div>
                )}
                {member.uid === club.createdBy && (
                   <div style={{fontSize: '10px', background: 'var(--primary-color)', padding: '2px 6px', borderRadius: '4px'}}>OWNER</div>
                )}
             </div>
           ))}
       </div>

       <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px'}}>
          <h3 style={{display: 'flex', alignItems: 'center', gap: '8px', margin: 0}}>
             <Activity color="var(--accent-color)"/> 
             Club Activity
          </h3>
          <select 
             value={activityFilter} 
             onChange={(e) => setActivityFilter(e.target.value)}
             style={{padding: '6px 12px', borderRadius: '20px', background: 'var(--bg-inset)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontSize: '12px'}}
          >
             <option value="all">All Time</option>
             <option value="today">Today</option>
             <option value="week">This Week</option>
             <option value="month">This Month</option>
          </select>
       </div>

       <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
          {filteredRides.slice(0, 30).map(ride => (
             <div key={ride.id} className="glass-panel" style={{padding: '0', overflow: 'hidden', cursor: 'pointer'}} onClick={() => navigate(`/ride/${ride.uid}/${ride.id}`)}>
                <div style={{padding: '16px', display: 'flex', alignItems: 'center', gap: '12px'}}>
                   {ride.userPhoto ? (
                      <img src={ride.userPhoto} alt="User" style={{width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover'}} referrerPolicy="no-referrer" />
                   ) : (
                      <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                         {ride.userName ? ride.userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                   )}
                   <div style={{flex: 1}}>
                      <div style={{fontWeight: 'bold', fontSize: '14px'}}>{ride.userName}</div>
                      <div style={{fontSize: '12px', color: 'var(--text-muted)'}}>{new Date(ride.date).toLocaleDateString()} at {new Date(ride.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                   </div>
                </div>
                
                <div style={{padding: '0 16px 16px 16px'}}>
                   <h4 style={{margin: '0 0 12px 0'}}>{ride.title || 'Cycling Route'}</h4>
                   <div style={{display: 'flex', justifyContent: 'space-between', background: 'var(--bg-inset)', padding: '12px', borderRadius: '8px'}}>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Distance</span>
                         <span style={{fontWeight: 'bold', fontSize: '16px'}}>{parseFloat(ride.distance || 0).toFixed(1)} <span style={{fontSize: '12px'}}>km</span></span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                         <span style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Time</span>
                         <span style={{fontWeight: 'bold', fontSize: '16px'}}>{formatTime(ride.duration)}</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                         <span style={{fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase'}}>Avg Speed</span>
                         <span style={{fontWeight: 'bold', fontSize: '16px'}}>{parseFloat(ride.averageSpeed || 0).toFixed(1)} <span style={{fontSize: '12px'}}>km/h</span></span>
                      </div>
                   </div>
                </div>
             </div>
          ))}
          {filteredRides.length === 0 && (
             <p style={{color: 'var(--text-muted)'}}>No recent activity found.</p>
          )}
       </div>

       {showQR && createPortal(
         <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999}} onClick={() => setShowQR(false)}>
            <div className="glass-panel" style={{padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', background: 'var(--bg-panel)', width: '90%', maxWidth: '350px'}} onClick={e => e.stopPropagation()}>
               <h3 style={{margin: 0, color: 'var(--text-main)'}}>Club Invite QR</h3>
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getShareUrl())}`} alt="QR Code" style={{width: '250px', height: '250px', background: 'white', padding: '10px', borderRadius: '8px'}} />
               <p style={{color: 'var(--text-muted)', fontSize: '14px', margin: 0, textAlign: 'center'}}>Scan to join {club.name}</p>
               <button onClick={() => setShowQR(false)} className="btn-secondary" style={{marginTop: '16px', width: '100%', color: 'var(--text-main)'}}>Close</button>
            </div>
         </div>,
         document.body
       )}

    </div>
  );
}
