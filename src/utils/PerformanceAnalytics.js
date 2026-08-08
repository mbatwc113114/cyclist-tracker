export class PerformanceAnalytics {
  
  static getRidesInPeriod(rides, period) {
    if (!rides || rides.length === 0) return [];
    
    const now = Date.now();
    const msInDay = 24 * 60 * 60 * 1000;
    
    return rides.filter(ride => {
       const age = now - ride.date;
       switch(period) {
          case 'today':
            const todayMidnight = new Date().setHours(0,0,0,0);
            return ride.date >= todayMidnight;
          case '7_days':
            return age <= 7 * msInDay;
          case '30_days':
            return age <= 30 * msInDay;
          case 'year':
            return age <= 365 * msInDay;
          case 'all_time':
          default:
            return true;
       }
    });
  }
  
  static calculateOverview(rides) {
    let totalDistance = 0;
    let movingTime = 0;
    let elevationGain = 0;
    let calories = 0;
    let maxSpeed = 0;
    
    rides.forEach(ride => {
       totalDistance += (Number(ride.distance) || 0);
       
       // Approximation for moving time if not explicitly saved
       movingTime += (Number(ride.movingTime || ride.duration) || 0);
       
       elevationGain += (Number(ride.elevationGain) || 0);
       calories += (Number(ride.calories) || 0);
       
       if (ride.maxSpeed && Number(ride.maxSpeed) > maxSpeed) {
          maxSpeed = Number(ride.maxSpeed);
       }
    });
    
    const movingTimeHours = movingTime / 3600;
    const averageSpeed = movingTimeHours > 0 ? (totalDistance / movingTimeHours) : 0;
    
    return {
       totalDistance: totalDistance.toFixed(2),
       rideCount: rides.length,
       movingTime: movingTime, // in seconds
       elevationGain: elevationGain.toFixed(0),
       calories: calories.toFixed(0),
       averageSpeed: averageSpeed.toFixed(1),
       maxSpeed: maxSpeed.toFixed(1)
    };
  }

  static calculatePersonalRecords(rides) {
    if (!rides || rides.length === 0) return null;
    
    let longestDistance = 0;
    let highestSpeed = 0;
    let highestElevation = 0;
    let longestRideTime = 0;
    
    rides.forEach(ride => {
      const distance = Number(ride.distance) || 0;
      const speed = Number(ride.maxSpeed) || 0;
      const elevation = Number(ride.elevationGain) || 0;
      const duration = Number(ride.movingTime || ride.duration) || 0;
      
      if (distance > longestDistance) longestDistance = distance;
      if (speed > highestSpeed) highestSpeed = speed;
      if (elevation > highestElevation) highestElevation = elevation;
      if (duration > longestRideTime) longestRideTime = duration;
    });
    
    return {
      longestDistance: longestDistance.toFixed(2),
      highestSpeed: highestSpeed.toFixed(1),
      highestElevation: highestElevation.toFixed(0),
      longestRideTime: this.formatDuration(longestRideTime)
    };
  }

  static calculateGoalProgress(rides, dailyGoal) {
    const dailyGoalNum = Number(dailyGoal) || 10;
    const weeklyGoal = dailyGoalNum * 7;
    const monthlyGoal = dailyGoalNum * 30; // Approximation

    const todayRides = this.getRidesInPeriod(rides, 'today');
    const weekRides = this.getRidesInPeriod(rides, '7_days');
    const monthRides = this.getRidesInPeriod(rides, '30_days');

    const todayDist = todayRides.reduce((acc, r) => acc + (Number(r.distance) || 0), 0);
    const weekDist = weekRides.reduce((acc, r) => acc + (Number(r.distance) || 0), 0);
    const monthDist = monthRides.reduce((acc, r) => acc + (Number(r.distance) || 0), 0);

    return {
      daily: { current: todayDist.toFixed(1), target: dailyGoalNum, percent: Math.min(100, Math.round((todayDist / dailyGoalNum) * 100)) },
      weekly: { current: weekDist.toFixed(1), target: weeklyGoal, percent: Math.min(100, Math.round((weekDist / weeklyGoal) * 100)) },
      monthly: { current: monthDist.toFixed(1), target: monthlyGoal, percent: Math.min(100, Math.round((monthDist / monthlyGoal) * 100)) }
    };
  }

  static formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s}s`;
  }
  
  static getWeeklyChartData(rides) {
     const data = [];
     const now = new Date();
     
     // Last 7 days
     for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        data.push({
           name: d.toLocaleDateString(undefined, { weekday: 'short' }),
           distance: 0,
           dateStr: d.toDateString() 
        });
     }
     
     rides.forEach(ride => {
        const rideDateStr = new Date(ride.date).toDateString();
        const dayEntry = data.find(d => d.dateStr === rideDateStr);
        if (dayEntry) {
           dayEntry.distance += (Number(ride.distance) || 0);
        }
     });
     
     return data.map(d => ({ name: d.name, distance: Number(d.distance.toFixed(1)) }));
  }
  
  static getMonthlyChartData(rides) {
     const data = [];
     const now = new Date();
     
     for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        data.push({
           name: d.toLocaleDateString(undefined, { month: 'short' }),
           distance: 0,
           month: d.getMonth(),
           year: d.getFullYear()
        });
     }
     
     rides.forEach(ride => {
        const rideDate = new Date(ride.date);
        const monthEntry = data.find(d => d.month === rideDate.getMonth() && d.year === rideDate.getFullYear());
        if (monthEntry) {
           monthEntry.distance += (Number(ride.distance) || 0);
        }
     });
     
     return data.map(d => ({ name: d.name, distance: Number(d.distance.toFixed(1)) }));
  }
}
