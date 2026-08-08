export function calculateStreak(rides) {
  if (!rides || rides.length === 0) return 0;

  // Group rides by local date string to ignore multiple rides on the same day
  const uniqueDays = new Set();
  rides.forEach(ride => {
     if (ride.date) {
        const d = new Date(ride.date);
        uniqueDays.add(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime());
     }
  });

  const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a); // Descending order
  
  if (sortedDays.length === 0) return 0;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;

  let currentStreak = 0;
  let expectedDay = today;

  // If the most recent ride wasn't today or yesterday, the streak is broken (0)
  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) {
      return 0;
  }

  // If the most recent ride was yesterday, that's where we start counting back
  if (sortedDays[0] === yesterday) {
      expectedDay = yesterday;
  }

  for (let i = 0; i < sortedDays.length; i++) {
      if (sortedDays[i] === expectedDay) {
          currentStreak++;
          expectedDay -= 86400000; // Go back one day
      } else {
          break; // Streak broken
      }
  }

  return currentStreak;
}
