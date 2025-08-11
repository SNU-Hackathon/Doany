// Simple global state for passing location data between screens
let selectedLocation: any = null;

export const LocationStore = {
  setLocation: (location: any) => {
    selectedLocation = location;
    console.log('[LocationStore] Location set:', location);
  },
  
  getLocation: () => {
    const location = selectedLocation;
    if (location) {
      // Clear after getting to prevent stale data
      selectedLocation = null;
      console.log('[LocationStore] Location retrieved and cleared:', location);
    }
    return location;
  },
  
  clearLocation: () => {
    selectedLocation = null;
    console.log('[LocationStore] Location cleared');
  }
};
