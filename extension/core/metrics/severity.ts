import { StoredStats, MascotState } from "../storage/schema";

// CHANGED: Increased limit to 1.0L (1000mL). 
// Previously 0.15L (150mL) was too small, causing instant melting.
const MAX_WASTE_LIMIT_LITERS = 1.0; 

export const recalculteSeverity = (stats: StoredStats): StoredStats => {
  const now = Date.now();
  
  const saved = stats.water.litersSavedDaily || 0;
  const wasted = stats.water.litersWastedDaily || 0;
  
  // Calculate Net Balance
  // Positive = Good (Green zone)
  // Negative = Bad (Red zone)
  const netBalance = saved - wasted;

  let score = 0; // 0 = Solid/Green, 100 = Puddle/Red

  if (netBalance >= 0) {
    // RECOVERY: If we are positive (Saved > Wasted), reset completely.
    // The mascot should be happy.
    score = 0;
  } else {
    // We are in debt.
    const debt = Math.abs(netBalance);
    
    // Calculate percentage of the way to the 1.0L limit
    // Example: 150mL debt / 1000mL limit = 15% score (Moves slowly)
    const percentage = (debt / MAX_WASTE_LIMIT_LITERS) * 100;
    
    // Clamp to 100 max
    score = Math.min(100, percentage);
  }

  // Determine Mascot State based on Slider Position (Score)
  let newState: MascotState = "SOLID";

  if (score >= 95) {
    // >95% -> Almost full liter debt -> Puddle
    newState = "DROPLET"; 
  } else if (score > 25) {
    // 25% - 95% -> Melting/Concerned
    newState = "MELTING";
  } else {
    // 0% - 25% -> Solid/Smiling
    // Even if slightly in debt (low score), he stays solid to be forgiving.
    
    // Check if "Thinking" state applies (recent 'Try Myself')
    const lastAction = stats.lastPrompts.lastTimestamp || 0;
    const isRecent = Date.now() - lastAction < 5 * 60 * 1000;
    
    if (isRecent && stats.today.tryMyselfClicks > 0 && score === 0) {
        newState = "THINKING";
    } else {
        newState = "SOLID";
    }
  }

  return {
    ...stats,
    severity: {
      score,
      mascotState: newState,
      lastUpdated: now,
    },
  };
};