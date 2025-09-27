/**
 * Dedicated Geocoding Worker
 * Handles address-to-coordinates conversion using OpenStreetMap Nominatim API
 */

export interface GeocodeRequest {
  address: string;
}

export interface GeocodeResponse {
  success: boolean;
  data?: {
    lat: string;
    lon: string;
    display_name: string;
  };
  error?: string;
}

/**
 * Geocoding Worker that provides address-to-coordinates conversion
 */
export default {
  async fetch(request: Request): Promise<Response> {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: {
          'Access-Control-Allow-Origin': '*',
        }
      });
    }

    try {
      // Parse the request body
      const body: GeocodeRequest = await request.json();
      
      if (!body.address || typeof body.address !== 'string' || body.address.trim() === '') {
        const errorResponse: GeocodeResponse = {
          success: false,
          error: 'Address is required and must be a non-empty string'
        };
        
        return new Response(JSON.stringify(errorResponse), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Call the Nominatim API
      const geocodeResult = await geocodeAddress(body.address);
      
      if (geocodeResult) {
        const successResponse: GeocodeResponse = {
          success: true,
          data: geocodeResult
        };
        
        return new Response(JSON.stringify(successResponse), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } else {
        const errorResponse: GeocodeResponse = {
          success: false,
          error: `No geocoding results found for address: "${body.address}"`
        };
        
        return new Response(JSON.stringify(errorResponse), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    } catch (error) {
      console.error('Geocoding worker error:', error);
      
      const errorResponse: GeocodeResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown geocoding error occurred'
      };
      
      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
} satisfies ExportedHandler;

/**
 * Internal geocoding function that calls the Nominatim API
 */
async function geocodeAddress(address: string): Promise<{ lat: string; lon: string; display_name: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'MapAgent-GeocodingWorker/1.0 (Cloudflare Workers)'
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Nominatim API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as Array<{
      lat: string;
      lon: string;
      display_name: string;
    }>;
    
    return data.length > 0 ? data[0] : null;
  } catch (error) {
    // Re-throw with more context but preserve original error
    if (error instanceof Error) {
      throw new Error(`Failed to geocode address "${address}": ${error.message}`);
    } else {
      throw new Error(`Failed to geocode address "${address}": Unknown error occurred`);
    }
  }
}
