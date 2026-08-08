import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { database } from '../firebase';
import { ref, onValue, update, get } from 'firebase/database';
import { Users, ArrowLeft, Settings, User, Activity, Share, QrCode, Target, Flame } from 'lucide-react';
import { calculateStreak } from '../utils/streak';
import { createPortal } from 'react-dom';
import { Haptics } from '../utils/haptics';

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
     Haptics.success();
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
    Haptics.success();
    await update(ref(database, `users/${currentUser.uid}`), { clubId: clubId });
    await update(ref(database, `clubs/${clubId}/members`), { [currentUser.uid]: true });
  };

  const handleLeaveClub = async () => {
    if (window.confirm("Are you sure you want to leave this club?")) {
       Haptics.warning();
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
     Haptics.light();
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
     return (
        <div className="page-enter-active" style={{padding: 'var(--space-xxl)', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%'}}>
           <div className="skeleton" style={{width: '100%', height: '200px', borderRadius: 'var(--radius-card)'}}></div>
        </div>
     );
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
    <div className="page-enter-active" style={{paddingBottom: '80px'}}>
       
       <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', marginBottom: 'var(--space-xxl)'}}>
         <button onClick={() => { Haptics.light(); navigate(-1); }} style={{background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', padding: '10px', borderRadius: '50%', cursor: 'pointer', display: 'flex'}}>
            <ArrowLeft size={24} />
         </button>
         <h1 className="text-display" style={{margin: 0}}>Club Detail</h1>
       </div>

       {club.targetDistance > 0 && (
          <div className="card" style={{padding: 'var(--space-lg)', marginBottom: 'var(--space-xxl)'}}>
             <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-md)'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary-main)'}}>
                   <Target size={20} />
                   <h4 className="text-h4" style={{margin: 0}}>Club Goal ({club.targetType})</h4>
                </div>
                <div className="text-body" style={{fontWeight: 700}}>{club.targetDistance} km</div>
             </div>
             <div style={{height: '12px', background: 'var(--surface-input)', borderRadius: 'var(--radius-pill)', overflow: 'hidden'}}>
                <div style={{height: '100%', width: `${targetProgress}%`, background: 'var(--primary-main)', transition: 'width 0.5s ease-out'}} />
             </div>
             <div className="text-caption" style={{color: 'var(--text-muted)', marginTop: 'var(--space-sm)', textAlign: 'right'}}>
                {targetProgress.toFixed(1)}% Completed
             </div>
          </div>
       )}

       <div className="card" style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)', padding: 'var(--space-xl)'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
             <div style={{display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', overflow: 'hidden'}}>
                {club.photoURL ? (
                   <img src={club.photoURL} alt="Club DP" style={{width: '72px', height: '72px', borderRadius: '50%', border: '2px solid var(--primary-main)', objectFit: 'cover'}} />
                ) : (
                   <div style={{width: '72px', height: '72px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <Users size={40} color="white" />
                   </div>
                )}
                <div style={{overflow: 'hidden'}}>
                   <h2 className="text-h2" style={{margin: 0, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden'}}>{club.name}</h2>
                   <div className="text-body-small" style={{color: 'var(--text-muted)'}}>{members.length} Members</div>
                </div>
             </div>
             <div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                <button onClick={() => { Haptics.light(); setShowQR(true); }} className="btn" style={{background: 'transparent', border: 'none', color: 'var(--text-primary)', padding: '8px'}}>
                   <QrCode size={24} />
                </button>
                <button onClick={handleShare} className="btn" style={{background: 'transparent', border: 'none', color: 'var(--primary-main)', padding: '8px'}}>
                   <Share size={24} />
                </button>
                {isAdmin && (
                   <button onClick={() => { Haptics.light(); setIsEditing(!isEditing); }} className="btn" style={{background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '8px'}}>
                      <Settings size={28} />
                   </button>
                )}
             </div>
          </div>
          
          {isEditing && isAdmin && (
             <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', marginTop: 'var(--space-sm)', background: 'var(--surface-input)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-card)'}}>
                <div>
                   <div className="text-label" style={{marginBottom: '4px'}}>Club Name</div>
                   <input type="text" className="input-field" value={editName} onChange={(e) => setEditName(e.target.value)} style={{width: '100%'}} />
                </div>
                <div>
                   <div className="text-label" style={{marginBottom: '4px'}}>Club Display Photo (URL)</div>
                   <input type="text" className="input-field" value={editPhoto} onChange={(e) => setEditPhoto(e.target.value)} placeholder="https://..." style={{width: '100%'}} />
                </div>
                <div style={{display: 'flex', gap: 'var(--space-md)'}}>
                   <div style={{flex: 1}}>
                      <div className="text-label" style={{marginBottom: '4px'}}>Target Distance (km)</div>
                      <input type="number" className="input-field" value={editTargetDistance} onChange={(e) => setEditTargetDistance(e.target.value)} placeholder="e.g. 500" style={{width: '100%'}} />
                   </div>
                   <div style={{flex: 1}}>
                      <div className="text-label" style={{marginBottom: '4px'}}>Target Type</div>
                      <select className="input-field" value={editTargetType} onChange={(e) => setEditTargetType(e.target.value)} style={{width: '100%'}}>
                         <option value="weekly">Weekly</option>
                         <option value="monthly">Monthly</option>
                      </select>
                   </div>
                </div>
                <button onClick={handleSaveClub} className="btn btn-primary" style={{marginTop: 'var(--space-sm)'}}>Save Changes</button>
             </div>
          )}

          {!isEditing && (
             <div style={{marginTop: 'var(--space-sm)'}}>
                {isMember ? (
                   <button onClick={handleLeaveClub} className="btn btn-danger" style={{width: '100%'}}>Leave Club</button>
                ) : (
                   <button onClick={handleJoinClub} className="btn btn-primary" style={{width: '100%'}}>Join Club</button>
                )}
             </div>
          )}
       </div>

       <h3 className="text-h3" style={{marginTop: 'var(--space-xxxl)', marginBottom: 'var(--space-lg)'}}>Members</h3>
       <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--space-md)', marginBottom: 'var(--space-xxxl)'}}>
           {members.map(member => (
             <div 
               key={member.uid} 
               className="card" 
               style={{padding: 'var(--space-md)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', textAlign: 'center'}} 
               onClick={() => { Haptics.light(); navigate(`/user/${member.uid}`); }}
             >
                {member.photoURL ? (
                   <img src={member.photoURL} alt="User" style={{width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover'}} referrerPolicy="no-referrer" />
                ) : (
                   <div style={{width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                      <User size={24} color="white" />
                   </div>
                )}
                <div className="text-body-small" style={{fontWeight: 700, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', width: '100%'}}>
                   {member.displayName || 'Anonymous'}
                </div>
                {member.streak > 0 && (
                   <div style={{display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--activity-calories)', fontWeight: 'bold', fontSize: '12px'}}>
                      <Flame size={16} fill="currentColor" />
                      {member.streak}
                   </div>
                )}
                {member.uid === club.createdBy && (
                   <div className="text-caption" style={{background: 'var(--primary-main)', color: 'white', padding: '2px 6px', borderRadius: '4px'}}>OWNER</div>
                )}
             </div>
           ))}
       </div>

       <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-lg)'}}>
          <h3 className="text-h3" style={{display: 'flex', alignItems: 'center', gap: '8px', margin: 0}}>
             <Activity color="var(--primary-main)"/> 
             Club Activity
          </h3>
          <select 
             className="input-field"
             value={activityFilter} 
             onChange={(e) => { Haptics.light(); setActivityFilter(e.target.value); }}
             style={{padding: '6px 12px', borderRadius: '20px', fontSize: '13px', height: 'auto'}}
          >
             <option value="all">All Time</option>
             <option value="today">Today</option>
             <option value="week">This Week</option>
             <option value="month">This Month</option>
          </select>
       </div>

       <div style={{display: 'flex', flexDirection: 'column', gap: 'var(--space-md)'}}>
          {filteredRides.slice(0, 30).map(ride => (
             <div key={ride.id} className="card" style={{padding: '0', overflow: 'hidden', cursor: 'pointer'}} onClick={() => { Haptics.light(); navigate(`/ride/${ride.uid}/${ride.id}`); }}>
                <div style={{padding: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '12px'}}>
                   {ride.userPhoto ? (
                      <img src={ride.userPhoto} alt="User" style={{width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover'}} referrerPolicy="no-referrer" />
                   ) : (
                      <div style={{width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'}}>
                         {ride.userName ? ride.userName.charAt(0).toUpperCase() : 'U'}
                      </div>
                   )}
                   <div style={{flex: 1}}>
                      <div className="text-body" style={{fontWeight: 700}}>{ride.userName}</div>
                      <div className="text-caption" style={{color: 'var(--text-muted)'}}>{new Date(ride.date).toLocaleDateString()} at {new Date(ride.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                   </div>
                </div>
                
                <div style={{padding: '0 var(--space-md) var(--space-md) var(--space-md)'}}>
                   <h4 className="text-h4" style={{margin: '0 0 var(--space-md) 0'}}>{ride.title || 'Cycling Route'}</h4>
                   <div style={{display: 'flex', justifyContent: 'space-between', background: 'var(--surface-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-sm)'}}>
                      <div style={{display: 'flex', flexDirection: 'column'}}>
                         <span className="text-label">Distance</span>
                         <span className="text-body" style={{fontWeight: 700, color: 'var(--activity-distance)'}}>{parseFloat(ride.distance || 0).toFixed(1)} <span style={{fontSize: '12px'}}>km</span></span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
                         <span className="text-label">Time</span>
                         <span className="text-body" style={{fontWeight: 700, color: 'var(--text-primary)'}}>{formatTime(ride.duration)}</span>
                      </div>
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end'}}>
                         <span className="text-label">Avg Speed</span>
                         <span className="text-body" style={{fontWeight: 700, color: 'var(--activity-speed)'}}>{parseFloat(ride.averageSpeed || 0).toFixed(1)} <span style={{fontSize: '12px'}}>km/h</span></span>
                      </div>
                   </div>
                </div>
             </div>
          ))}
          {filteredRides.length === 0 && (
             <p className="text-body" style={{color: 'var(--text-muted)'}}>No recent activity found.</p>
          )}
       </div>

       {showQR && createPortal(
         <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(7,11,20,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999, backdropFilter: 'blur(8px)'}} onClick={() => { Haptics.light(); setShowQR(false); }}>
            <div className="card" style={{padding: 'var(--space-xxxl)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-lg)', width: '90%', maxWidth: '350px'}} onClick={e => e.stopPropagation()}>
               <h3 className="text-h3" style={{margin: 0}}>Club Invite QR</h3>
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getShareUrl())}`} alt="QR Code" style={{width: '250px', height: '250px', background: 'white', padding: '10px', borderRadius: 'var(--radius-sm)'}} />
               <p className="text-body-small" style={{color: 'var(--text-muted)', margin: 0, textAlign: 'center'}}>Scan to join {club.name}</p>
               <button onClick={() => { Haptics.light(); setShowQR(false); }} className="btn btn-secondary" style={{marginTop: 'var(--space-md)', width: '100%'}}>Close</button>
            </div>
         </div>,
         document.body
       )}

    </div>
  );
}
