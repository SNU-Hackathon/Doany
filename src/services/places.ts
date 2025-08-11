// Google Places API service for location search and details

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export type TargetLocation = { 
  name: string; 
  placeId?: string; 
  lat: number; 
  lng: number; 
  address?: string; 
};

// Runtime check for API key
export const checkGoogleMapsApiKey = (): boolean => {
  if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
    console.error('[Places] Google Maps API key is missing or not configured');
    console.error('[Places] Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY environment variable and restart the app');
    return false;
  }
  return true;
};

const getApiKey = (): string => {
  if (!checkGoogleMapsApiKey()) {
    throw new Error('Google Maps API key not configured');
  }
  return GOOGLE_MAPS_API_KEY!;
};

// Search places using Google Places Autocomplete API
export const searchPlaces = async (input: string): Promise<Array<{placeId: string; description: string}>> => {
  try {
    const apiKey = getApiKey();
    console.log('[Places] Searching for:', input);
    
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&language=en&types=establishment|geocode`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.error('[Places] API error:', data.status, data.error_message);
      if (data.status === 'REQUEST_DENIED') {
        console.error('[Places] Key not authorized. Enable Places API + Billing. Restrict by API (Places API), and avoid app restrictions during dev.');
      }
      throw new Error(data.error_message || `Places API error: ${data.status}`);
    }
    
    if (data.status !== 'OK') {
      console.warn('[Places] Unexpected status:', data.status, data.error_message);
      return [];
    }
    
    const predictions = data.predictions || [];
    console.log('[Places] Found', predictions.length, 'predictions');
    
    return predictions.map((prediction: any) => ({
      placeId: prediction.place_id,
      description: prediction.description
    }));
    
  } catch (error) {
    console.error('[Places] Search error:', error);
    throw error;
  }
};

// Get place details using Google Places Details API
export const getPlaceDetails = async (placeId: string): Promise<TargetLocation> => {
  try {
    const apiKey = getApiKey();
    console.log('[Places] Getting details for place:', placeId);
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,geometry&key=${apiKey}&language=en`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.error('[Places] Details API error:', data.status, data.error_message);
      throw new Error(data.error_message || `Places Details API error: ${data.status}`);
    }
    
    if (data.status !== 'OK') {
      console.warn('[Places] Details unexpected status:', data.status, data.error_message);
      throw new Error(`Failed to get place details: ${data.status}`);
    }
    
    const result = data.result;
    const location: TargetLocation = {
      name: result.name,
      placeId: result.place_id,
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      address: result.formatted_address
    };
    
    console.log('[Places] Place details retrieved:', location.name);
    return location;
    
  } catch (error) {
    console.error('[Places] Get place details error:', error);
    throw error;
  }
};

// Reverse geocoding using Google Geocoding API
export const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
  try {
    const apiKey = getApiKey();
    console.log('[Places] Reverse geocoding:', lat, lng);
    
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      console.error('[Places] Geocoding API error:', data.status, data.error_message);
      return null;
    }
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.warn('[Places] Geocoding no results:', data.status);
      return null;
    }
    
    const address = data.results[0].formatted_address;
    console.log('[Places] Reverse geocoded address:', address);
    return address;
    
  } catch (error) {
    console.error('[Places] Reverse geocoding error:', error);
    return null;
  }
};
