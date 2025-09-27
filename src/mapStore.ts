/**
 * Shared map store for managing location data
 * This allows both the chat tools and map component to access the same data
 */

export interface MarkerData {
  id: string // First 16 digits of address hash
  position: [number, number]
  address: string
  notes: string
  originalAddress: string
  color: string
}

interface SearchResult {
  lat: string
  lon: string
  display_name: string
}

// Available colors for markers
const markerColors = ['red', 'blue', 'green', 'purple', 'orange', 'yellow', 'violet', 'grey', 'black']

// Utility function to generate unique ID from address hash
const generateLocationId = (address: string): string => {
  // Simple hash function to generate consistent ID from address
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive number and take first 16 digits
  const positiveHash = Math.abs(hash).toString();
  return positiveHash.padStart(16, '0').substring(0, 16);
}


// Geocoding function
const geocodeAddress = async (address: string): Promise<SearchResult | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      {
        headers: {
          'User-Agent': 'MapAgent/1.0 (Cloudflare Workers)'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Geocoding API request failed: ${response.status} ${response.statusText}`)
    }
    
    const data: SearchResult[] = await response.json()
    return data.length > 0 ? data[0] : null
  } catch (error) {
    // Re-throw with more context but preserve original error
    if (error instanceof Error) {
      throw new Error(`Failed to geocode address "${address}": ${error.message}`)
    } else {
      throw new Error(`Failed to geocode address "${address}": Unknown error occurred`)
    }
  }
}

// Global map store
class MapStore {
  private markers: MarkerData[] = []
  private listeners: Set<() => void> = new Set()

  // Subscribe to changes
  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Notify all listeners of changes
  private notify() {
    this.listeners.forEach(listener => listener())
  }

  // Get all markers
  getMarkers(): MarkerData[] {
    return [...this.markers] // Return copy to prevent mutation
  }

  // Set markers (for component initialization)
  setMarkers(markers: MarkerData[]) {
    this.markers = [...markers]
    this.notify()
  }

  // 1. List all plotted locations
  listPlottedLocations(): MarkerData[] {
    return this.getMarkers()
  }

  // 2. Get a plotted location by its unique ID
  getLocationById(id: string): MarkerData | null {
    const marker = this.markers.find(m => m.id === id)
    return marker ? { ...marker } : null
  }

  // 3. Add a new location by address
  async addLocationByAddress(
    address: string, 
    notes: string = '', 
    color: string = 'red'
  ): Promise<{ success: boolean; message: string; location?: MarkerData; error?: Error }> {
    try {
      // Validate inputs
      if (!address || address.trim() === '') {
        const error = new Error('Address cannot be empty')
        return { success: false, message: error.message, error }
      }

      // Validate color
      if (!markerColors.includes(color)) {
        const error = new Error(`Invalid color "${color}". Must be one of: ${markerColors.join(', ')}`)
        return { success: false, message: error.message, error }
      }

      // Generate ID from address
      const id = generateLocationId(address)
      
      // Check if location already exists
      const existingMarker = this.markers.find(m => m.id === id)
      if (existingMarker) {
        const error = new Error(`Location with this address already exists: "${existingMarker.originalAddress}" (ID: ${id})`)
        return { success: false, message: error.message, error }
      }

      // Geocode the address - this will throw detailed errors
      const result = await geocodeAddress(address)
      
      if (!result) {
        const error = new Error(`No geocoding results found for address: "${address}". Please check the address and try again.`)
        return { success: false, message: error.message, error }
      }

      // Validate geocoding result
      const lat = parseFloat(result.lat)
      const lon = parseFloat(result.lon)
      
      if (isNaN(lat) || isNaN(lon)) {
        const error = new Error(`Invalid coordinates received from geocoding service for "${address}": lat=${result.lat}, lon=${result.lon}`)
        return { success: false, message: error.message, error }
      }

      const newMarker: MarkerData = {
        id,
        position: [lat, lon],
        address: result.display_name,
        notes,
        originalAddress: address,
        color
      }

      this.markers.push(newMarker)
      this.notify()

      return { 
        success: true, 
        message: `Successfully added location: ${address}`, 
        location: newMarker 
      }
    } catch (error) {
      // Preserve the original error object and message
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred')
      return { 
        success: false, 
        message: errorObj.message,
        error: errorObj
      }
    }
  }

  // 4. Update a location by ID (can only update notes and color, not address/position)
  updateLocationById(
    id: string, 
    updates: { notes?: string; color?: string }
  ): { success: boolean; message: string; location?: MarkerData; error?: Error } {
    try {
      // Validate input
      if (!id || id.trim() === '') {
        const error = new Error('Location ID cannot be empty')
        return { success: false, message: error.message, error }
      }

      // Validate that at least one field is being updated
      if (!updates.notes && !updates.color) {
        const error = new Error('At least one field (notes or color) must be provided for update')
        return { success: false, message: error.message, error }
      }

      // Validate color if provided
      if (updates.color && !markerColors.includes(updates.color)) {
        const error = new Error(`Invalid color "${updates.color}". Must be one of: ${markerColors.join(', ')}`)
        return { success: false, message: error.message, error }
      }

      const markerIndex = this.markers.findIndex(m => m.id === id)
      
      if (markerIndex === -1) {
        const availableIds = this.markers.length > 0 
          ? `Available IDs: ${this.markers.map(m => m.id).join(', ')}` 
          : 'No locations are currently plotted on the map.'
        const error = new Error(`Location with ID "${id}" not found. ${availableIds}`)
        return { success: false, message: error.message, error }
      }

      const originalMarker = this.markers[markerIndex]
      
      // Create updated marker with only the allowed fields changed
      const updatedMarker: MarkerData = {
        ...originalMarker,
        notes: updates.notes !== undefined ? updates.notes : originalMarker.notes,
        color: updates.color !== undefined ? updates.color : originalMarker.color
      }

      // Update the marker in the array
      this.markers[markerIndex] = updatedMarker
      this.notify()
      
      const changedFields = []
      if (updates.notes !== undefined) changedFields.push(`notes: "${updates.notes}"`)
      if (updates.color !== undefined) changedFields.push(`color: ${updates.color}`)
      
      return { 
        success: true, 
        message: `Successfully updated location "${originalMarker.originalAddress}" (ID: ${id}). Changed: ${changedFields.join(', ')}`,
        location: updatedMarker
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred while updating location')
      return { 
        success: false, 
        message: errorObj.message,
        error: errorObj
      }
    }
  }

  // 5. Delete a location by ID
  deleteLocationById(id: string): { success: boolean; message: string; error?: Error } {
    try {
      // Validate input
      if (!id || id.trim() === '') {
        const error = new Error('Location ID cannot be empty')
        return { success: false, message: error.message, error }
      }

      const markerIndex = this.markers.findIndex(m => m.id === id)
      
      if (markerIndex === -1) {
        const availableIds = this.markers.length > 0 
          ? `Available IDs: ${this.markers.map(m => m.id).join(', ')}` 
          : 'No locations are currently plotted on the map.'
        const error = new Error(`Location with ID "${id}" not found. ${availableIds}`)
        return { success: false, message: error.message, error }
      }

      const deletedMarker = this.markers[markerIndex]
      this.markers = this.markers.filter(m => m.id !== id)
      this.notify()
      
      return { 
        success: true, 
        message: `Successfully deleted location: "${deletedMarker.originalAddress}" (ID: ${id})` 
      }
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error occurred while deleting location')
      return { 
        success: false, 
        message: errorObj.message,
        error: errorObj
      }
    }
  }

  // Clear all markers
  clearAllLocations(): { success: boolean; message: string } {
    const count = this.markers.length
    this.markers = []
    this.notify()
    return { 
      success: true, 
      message: `Cleared ${count} locations from the map` 
    }
  }
}

// Export singleton instance
export const mapStore = new MapStore()

// Export utility functions for external use
export { generateLocationId, markerColors }
