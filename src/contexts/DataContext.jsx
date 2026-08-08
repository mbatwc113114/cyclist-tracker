import React, { createContext, useContext, useState, useEffect } from 'react';
import { database } from '../firebase';
import { ref, get, onValue } from 'firebase/database';

const DataContext = createContext();

export function DataProvider({ children, user }) {
  const [usersDict, setUsersDict] = useState({});
  const [allRides, setAllRides] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    if (!user) return;

    // 1. Load from cache immediately
    const cachedUsers = localStorage.getItem('cache_users_v2');
    const cachedRides = localStorage.getItem('cache_rides_v2');
    const cacheTimestamp = localStorage.getItem('cache_timestamp');

    let initialUsers = {};
    let initialRides = [];
    if (cachedUsers) {
       try { initialUsers = JSON.parse(cachedUsers); setUsersDict(initialUsers); } catch(e){}
    }
    if (cachedRides) {
       try { initialRides = JSON.parse(cachedRides); setAllRides(initialRides); } catch(e){}
    }

    // 2. Listen to metadata/lastUpdated
    const metaRef = ref(database, 'metadata/lastUpdated');
    const unsubscribeMeta = onValue(metaRef, async (snapshot) => {
       const serverLastUpdated = snapshot.val() || 0;
       const localLastUpdated = Number(cacheTimestamp) || 0;

       if (serverLastUpdated > localLastUpdated || !cachedUsers || !cachedRides) {
          console.log("Stale cache, fetching fresh data from Firebase...");
          
          try {
             const [usersSnap, ridesSnap] = await Promise.all([
                get(ref(database, 'users')),
                get(ref(database, 'rides'))
             ]);

             if (usersSnap.exists()) {
                const uData = usersSnap.val();
                setUsersDict(uData);
                localStorage.setItem('cache_users_v2', JSON.stringify(uData));
             }

             if (ridesSnap.exists()) {
                const rData = ridesSnap.val();
                let ridesList = [];
                Object.keys(rData).forEach(uid => {
                   Object.keys(rData[uid]).forEach(rideId => {
                      if (!rData[uid][rideId].isCustomRoute) {
                         ridesList.push({ id: rideId, uid: uid, ...rData[uid][rideId] });
                      }
                   });
                });
                setAllRides(ridesList);
                localStorage.setItem('cache_rides_v2', JSON.stringify(ridesList));
             }

             localStorage.setItem('cache_timestamp', serverLastUpdated.toString());
          } catch(err) {
             console.error("Failed to fetch fresh data", err);
          }
       }
       setIsInitializing(false);
    });

    return () => unsubscribeMeta();
  }, [user]);

  return (
    <DataContext.Provider value={{ usersDict, allRides, isInitializing }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
