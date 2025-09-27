/**
 * Tool definitions for the AI chat agent
 * Tools can either require human confirmation or execute automatically
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

import type { Chat } from "./server";
import { getCurrentAgent } from "agents";
import { scheduleSchema } from "agents/schedule";
import { generateLocationId, markerColors, type MarkerData } from "./mapStore";

// Geocoding function for server-side use
interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
}

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

/**
 * Map Location Management Tools
 * These tools allow the AI to interact with the map component
 */

/**
 * List all plotted locations on the map
 */
const listMapLocations = tool({
  description: "List all locations currently plotted on the map",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      const locations = agent!.state.markers;
      
      if (locations.length === 0) {
        return "No locations are currently plotted on the map.";
      }

      const locationList = locations.map((loc, index) => 
        `${index + 1}. ${loc.originalAddress} (ID: ${loc.id})\n   Notes: ${loc.notes}\n   Color: ${loc.color}\n   Coordinates: ${loc.position[0].toFixed(4)}, ${loc.position[1].toFixed(4)}`
      ).join('\n\n');

      return `Found ${locations.length} location(s) on the map:\n\n${locationList}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Unexpected error in listMapLocations tool:', error);
      return `❌ Error listing locations: ${errorMessage}`;
    }
  }
});

/**
 * Get a specific location by its unique ID
 */
const getMapLocationById = tool({
  description: "Get details of a specific map location using its unique ID",
  inputSchema: z.object({
    id: z.string().describe("The unique 16-digit ID of the location")
  }),
  execute: async ({ id }) => {
    try {
      // Validate input
      if (!id || id.trim() === '') {
        return `❌ Error: Location ID cannot be empty`;
      }

      const { agent } = getCurrentAgent<Chat>();
      const location = agent!.state.markers.find(m => m.id === id);
      
      if (!location) {
        const allLocations = agent!.state.markers;
        const availableIds = allLocations.length > 0 
          ? `Available IDs: ${allLocations.map(l => l.id).join(', ')}` 
          : 'No locations are currently plotted on the map.';
        return `❌ No location found with ID: ${id}\n\n${availableIds}`;
      }

      return `Location Details:
- Address: ${location.originalAddress}
- Full Address: ${location.address}
- Notes: ${location.notes}
- Color: ${location.color}
- ID: ${location.id}
- Coordinates: ${location.position[0].toFixed(4)}, ${location.position[1].toFixed(4)}`;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Unexpected error in getMapLocationById tool:', error);
      return `❌ Error retrieving location: ${errorMessage}`;
    }
  }
});

/**
 * Add a new location to the map by address
 */
const addMapLocation = tool({
  description: "Add a new location to the map by providing an address. The address will be geocoded automatically.",
  inputSchema: z.object({
    address: z.string().describe("The address or location to add to the map"),
    notes: z.string().optional().describe("Optional notes or description for the location"),
    color: z.enum(['red', 'blue', 'green', 'purple', 'orange', 'yellow', 'violet', 'grey', 'black']).optional().describe("Optional color for the map marker (defaults to red)")
  }),
  execute: async ({ address, notes = '', color = 'red' }) => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      
      // Validate inputs
      if (!address || address.trim() === '') {
        return `❌ Error: Address cannot be empty`;
      }

      // Validate color
      if (!markerColors.includes(color)) {
        return `❌ Error: Invalid color "${color}". Must be one of: ${markerColors.join(', ')}`;
      }

      // Generate ID from address
      const id = generateLocationId(address);
      
      // Check if location already exists
      const existingMarker = agent!.state.markers.find(m => m.id === id);
      if (existingMarker) {
        return `❌ Error: Location with this address already exists: "${existingMarker.originalAddress}" (ID: ${id})`;
      }

      // Geocode the address
      const result = await geocodeAddress(address);
      
      if (!result) {
        return `❌ Error: No geocoding results found for address: "${address}". Please check the address and try again.`;
      }

      // Validate geocoding result
      const lat = parseFloat(result.lat);
      const lon = parseFloat(result.lon);
      
      if (isNaN(lat) || isNaN(lon)) {
        return `❌ Error: Invalid coordinates received from geocoding service for "${address}": lat=${result.lat}, lon=${result.lon}`;
      }

      const newMarker: MarkerData = {
        id,
        position: [lat, lon],
        address: result.display_name,
        notes,
        originalAddress: address,
        color
      };

      // Update agent state with new marker
      const newState = {
        ...agent!.state,
        markers: [...agent!.state.markers, newMarker],
        // Center map on new marker if it's the first one
        mapCenter: agent!.state.markers.length === 0 ? newMarker.position : agent!.state.mapCenter,
        mapZoom: agent!.state.markers.length === 0 ? 10 : agent!.state.mapZoom
      };
      
      agent!.setState(newState);

      return `✅ Successfully added location to the map:
- Address: ${newMarker.originalAddress}
- Full Address: ${newMarker.address}
- Notes: ${newMarker.notes}
- Color: ${newMarker.color}
- ID: ${newMarker.id}
- Coordinates: ${newMarker.position[0].toFixed(4)}, ${newMarker.position[1].toFixed(4)}

The location is now visible on the map!`;
    } catch (error) {
      // Handle any unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Unexpected error in addMapLocation tool:', error);
      return `❌ Unexpected error while adding location: ${errorMessage}`;
    }
  }
});

/**
 * Update a location on the map by its ID
 */
const updateMapLocation = tool({
  description: "Update the notes and/or color of an existing map location using its unique ID. The address and coordinates cannot be changed.",
  inputSchema: z.object({
    id: z.string().describe("The unique 16-digit ID of the location to update"),
    notes: z.string().optional().describe("Optional new notes or description for the location"),
    color: z.enum(['red', 'blue', 'green', 'purple', 'orange', 'yellow', 'violet', 'grey', 'black']).optional().describe("Optional new color for the map marker")
  }),
  execute: async ({ id, notes, color }) => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      
      // Validate input
      if (!id || id.trim() === '') {
        return `❌ Error: Location ID cannot be empty`;
      }

      // Validate that at least one field is being updated
      if (notes === undefined && color === undefined) {
        return `❌ Error: At least one field (notes or color) must be provided for update`;
      }

      // Validate color if provided
      if (color && !markerColors.includes(color)) {
        return `❌ Error: Invalid color "${color}". Must be one of: ${markerColors.join(', ')}`;
      }

      const markerIndex = agent!.state.markers.findIndex(m => m.id === id);
      
      if (markerIndex === -1) {
        const availableIds = agent!.state.markers.length > 0 
          ? `Available IDs: ${agent!.state.markers.map(m => m.id).join(', ')}` 
          : 'No locations are currently plotted on the map.';
        return `❌ Error: Location with ID "${id}" not found. ${availableIds}`;
      }

      const originalMarker = agent!.state.markers[markerIndex];
      
      // Create updated marker with only the allowed fields changed
      const updatedMarker: MarkerData = {
        ...originalMarker,
        notes: notes !== undefined ? notes : originalMarker.notes,
        color: color !== undefined ? color : originalMarker.color
      };

      // Update agent state with the modified marker
      const newMarkers = [...agent!.state.markers];
      newMarkers[markerIndex] = updatedMarker;
      
      const newState = {
        ...agent!.state,
        markers: newMarkers
      };
      
      agent!.setState(newState);
      
      const changedFields = [];
      if (notes !== undefined) changedFields.push(`notes: "${notes}"`);
      if (color !== undefined) changedFields.push(`color: ${color}`);
      
      return `✅ Successfully updated location "${originalMarker.originalAddress}" (ID: ${id}):
- Address: ${updatedMarker.originalAddress} (unchanged)
- Full Address: ${updatedMarker.address} (unchanged)
- Notes: ${updatedMarker.notes}
- Color: ${updatedMarker.color}
- ID: ${updatedMarker.id} (unchanged)
- Coordinates: ${updatedMarker.position[0].toFixed(4)}, ${updatedMarker.position[1].toFixed(4)} (unchanged)

Changed fields: ${changedFields.join(', ')}
The updated location is now visible on the map!`;
    } catch (error) {
      // Handle any unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Unexpected error in updateMapLocation tool:', error);
      return `❌ Unexpected error while updating location: ${errorMessage}`;
    }
  }
});

/**
 * Delete a location from the map by its ID
 */
const deleteMapLocation = tool({
  description: "Remove a location from the map using its unique ID",
  inputSchema: z.object({
    id: z.string().describe("The unique 16-digit ID of the location to delete")
  }),
  execute: async ({ id }) => {
    try {
      const { agent } = getCurrentAgent<Chat>();
      
      // Validate input
      if (!id || id.trim() === '') {
        return `❌ Error: Location ID cannot be empty`;
      }

      const markerIndex = agent!.state.markers.findIndex(m => m.id === id);
      
      if (markerIndex === -1) {
        const availableIds = agent!.state.markers.length > 0 
          ? `Available IDs: ${agent!.state.markers.map(m => m.id).join(', ')}` 
          : 'No locations are currently plotted on the map.';
        return `❌ Error: Location with ID "${id}" not found. ${availableIds}`;
      }

      const deletedMarker = agent!.state.markers[markerIndex];
      
      // Update agent state by removing the marker
      const newState = {
        ...agent!.state,
        markers: agent!.state.markers.filter(m => m.id !== id)
      };
      
      agent!.setState(newState);
      
      return `✅ Successfully deleted location: "${deletedMarker.originalAddress}" (ID: ${id})`;
    } catch (error) {
      // Handle any unexpected errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Unexpected error in deleteMapLocation tool:', error);
      return `❌ Unexpected error while deleting location: ${errorMessage}`;
    }
  }
});

const scheduleTask = tool({
  description: "A tool to schedule a task to be executed at a later time",
  inputSchema: scheduleSchema,
  execute: async ({ when, description }) => {
    // we can now read the agent context from the ALS store
    const { agent } = getCurrentAgent<Chat>();

    function throwError(msg: string): string {
      throw new Error(msg);
    }
    if (when.type === "no-schedule") {
      return "Not a valid schedule input";
    }
    const input =
      when.type === "scheduled"
        ? when.date // scheduled
        : when.type === "delayed"
          ? when.delayInSeconds // delayed
          : when.type === "cron"
            ? when.cron // cron
            : throwError("not a valid schedule input");
    try {
      agent!.schedule(input!, "executeTask", description);
    } catch (error) {
      console.error("error scheduling task", error);
      return `Error scheduling task: ${error}`;
    }
    return `Task scheduled for type "${when.type}" : ${input}`;
  }
});

/**
 * Tool to list all scheduled tasks
 * This executes automatically without requiring human confirmation
 */
const getScheduledTasks = tool({
  description: "List all tasks that have been scheduled",
  inputSchema: z.object({}),
  execute: async () => {
    const { agent } = getCurrentAgent<Chat>();

    try {
      const tasks = agent!.getSchedules();
      if (!tasks || tasks.length === 0) {
        return "No scheduled tasks found.";
      }
      return tasks;
    } catch (error) {
      console.error("Error listing scheduled tasks", error);
      return `Error listing scheduled tasks: ${error}`;
    }
  }
});

/**
 * Tool to cancel a scheduled task by its ID
 * This executes automatically without requiring human confirmation
 */
const cancelScheduledTask = tool({
  description: "Cancel a scheduled task using its ID",
  inputSchema: z.object({
    taskId: z.string().describe("The ID of the task to cancel")
  }),
  execute: async ({ taskId }) => {
    const { agent } = getCurrentAgent<Chat>();
    try {
      await agent!.cancelSchedule(taskId);
      return `Task ${taskId} has been successfully canceled.`;
    } catch (error) {
      console.error("Error canceling scheduled task", error);
      return `Error canceling task ${taskId}: ${error}`;
    }
  }
});

/**
 * Export all available tools
 * These will be provided to the AI model to describe available capabilities
 */
export const tools = {
  listMapLocations,
  getMapLocationById,
  addMapLocation,
  updateMapLocation,
  deleteMapLocation,
  scheduleTask,
  getScheduledTasks,
  cancelScheduledTask
} satisfies ToolSet;

/**
 * Implementation of confirmation-required tools
 * This object contains the actual logic for tools that need human approval
 * Each function here corresponds to a tool above that doesn't have an execute function
 * 
 * Currently empty as all map tools execute automatically
 */
export const executions = {
  // No confirmation-required tools at the moment
  // All map management tools execute automatically for better UX
};
