'use client'

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { useState, useRef, useEffect } from 'react'
import { useAgent } from "agents/react";
import { type MarkerData, generateLocationId } from '@/mapStore'

// Fix for default markers in React Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Create colored marker icons
const createColoredIcon = (color: string) => {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })
}

// SearchResult interface moved to mapStore

// Component to handle map updates
function MapUpdater({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap()
  map.setView(center, zoom)
  return null
}

export default function MapComponent() {
  const [markers, setMarkers] = useState<MarkerData[]>([])
  const [mapCenter, setMapCenter] = useState<[number, number]>([51.505, -0.09])
  const [mapZoom, setMapZoom] = useState(2)
  const [processingStatus, setProcessingStatus] = useState('')
  const [exportData, setExportData] = useState('')
  const [importData, setImportData] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [agentState, setAgentState] = useState<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Connect to the agent and sync with its state
  const agent = useAgent({
    agent: "chat",
    onStateUpdate: (newState: any) => {
      console.log('Agent state updated:', newState);
      setAgentState(newState);
      if (newState && newState.markers) {
        setMarkers(newState.markers);
        setMapCenter(newState.mapCenter || [51.505, -0.09]);
        setMapZoom(newState.mapZoom || 2);
      }
    }
  });

  // Initialize with agent state when it becomes available
  useEffect(() => {
    if (agentState && agentState.markers) {
      setMarkers(agentState.markers);
      setMapCenter(agentState.mapCenter || [51.505, -0.09]);
      setMapZoom(agentState.mapZoom || 2);
    }
  }, [agentState])

  // Core functions for location management (now using agent state)
  
  // 1. List all plotted locations
  const listPlottedLocations = (): MarkerData[] => {
    return markers;
  }

  // 2. Get a plotted location by its unique ID
  const getLocationById = (id: string): MarkerData | null => {
    return markers.find(m => m.id === id) || null;
  }

  // 3. Add a new location by address (now handled by server tools)
  const addLocationByAddress = async (
    address: string, 
    notes: string = '', 
    color: string = 'red'
  ): Promise<{ success: boolean; message: string; location?: MarkerData; error?: Error }> => {
    // This is now handled by the server-side tools
    return { success: false, message: "Use chat tools to add locations" };
  }

  // 4. Update a location by ID (now handled by server tools)
  const updateLocationById = (
    id: string, 
    updates: { notes?: string; color?: string }
  ): { success: boolean; message: string; location?: MarkerData; error?: Error } => {
    // This is now handled by the server-side tools
    return { success: false, message: "Use chat tools to update locations" };
  }

  // 5. Delete a location by ID (now handled by server tools)
  const deleteLocationById = (id: string): { success: boolean; message: string; error?: Error } => {
    // This is now handled by the server-side tools
    return { success: false, message: "Use chat tools to delete locations" };
  }

  // Geocoding function moved to mapStore

  // Commented out - JSON input processing function (now using programmatic functions)
  // const processJsonInput = async () => { ... }

  const prepareExportData = () => {
    if (markers.length === 0) {
      setProcessingStatus('No markers to export')
      setTimeout(() => setProcessingStatus(''), 3000)
      return
    }

    const exportDataObj = {
      mapCenter,
      mapZoom,
      markers: markers.map(marker => ({
        id: marker.id,
        position: marker.position,
        address: marker.address,
        notes: marker.notes,
        originalAddress: marker.originalAddress,
        color: marker.color
      })),
      exportedAt: new Date().toISOString(),
      totalMarkers: markers.length
    }

    const dataStr = JSON.stringify(exportDataObj, null, 2)
    setExportData(dataStr)
    setShowExportModal(true)
  }

  const downloadMapData = () => {
    const dataBlob = new Blob([exportData], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `map-data-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setProcessingStatus(`Downloaded ${markers.length} locations to file`)
    setTimeout(() => setProcessingStatus(''), 3000)
    setShowExportModal(false)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportData)
      setProcessingStatus('Map data copied to clipboard!')
      setTimeout(() => setProcessingStatus(''), 3000)
      setShowExportModal(false)
    } catch (error) {
      setProcessingStatus('Failed to copy to clipboard')
      setTimeout(() => setProcessingStatus(''), 3000)
    }
  }

  const exportAsHTML = () => {
    if (markers.length === 0) {
      setProcessingStatus('No markers to export')
      setTimeout(() => setProcessingStatus(''), 3000)
      return
    }

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Exported Map - ${markers.length} Locations</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" 
          integrity="sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A==" 
          crossorigin=""/>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0e7ff 100%);
            min-height: 100vh;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .header {
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        
        .header h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 16px;
        }
        
        .map-container {
            position: relative;
            height: 70vh;
            min-height: 500px;
        }
        
        #map {
            height: 100%;
            width: 100%;
        }
        
        .info-panel {
            padding: 20px;
            background: #f8fafc;
            border-top: 1px solid #e2e8f0;
        }
        
        .locations-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 12px;
            margin-top: 12px;
        }
        
        .location-card {
            background: white;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .color-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-top: 4px;
            flex-shrink: 0;
        }
        
        .location-info h4 {
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 4px;
            font-size: 14px;
        }
        
        .location-info p {
            color: #6b7280;
            font-size: 12px;
            line-height: 1.4;
        }
        
        .leaflet-popup-content {
            font-family: inherit !important;
        }
        
        .popup-content {
            font-size: 14px;
            line-height: 1.5;
        }
        
        .popup-content strong {
            color: #1f2937;
            display: block;
            margin-bottom: 8px;
            font-size: 15px;
        }
        
        .popup-field {
            margin-bottom: 6px;
            color: #374151;
        }
        
        .popup-field strong {
            display: inline;
            margin-bottom: 0;
            margin-right: 6px;
            font-size: 14px;
        }
        
        .popup-coordinates {
            font-size: 12px;
            color: #6b7280;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
        }
        
        .color-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            color: white;
            margin-left: 4px;
        }
        
        /* Color classes for badges */
        .color-red { background-color: #dc2626; }
        .color-blue { background-color: #2563eb; }
        .color-green { background-color: #16a34a; }
        .color-purple { background-color: #9333ea; }
        .color-orange { background-color: #ea580c; }
        .color-yellow { background-color: #ca8a04; }
        .color-violet { background-color: #7c3aed; }
        .color-grey { background-color: #6b7280; }
        .color-black { background-color: #1f2937; }

        @media (max-width: 768px) {
            body { padding: 10px; }
            .header { padding: 15px; }
            .header h1 { font-size: 20px; }
            .info-panel { padding: 15px; }
            .map-container { height: 60vh; min-height: 400px; }
            .locations-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📍 Interactive Map</h1>
            <p>${markers.length} locations plotted • Exported on ${new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="map-container">
            <div id="map"></div>
        </div>
        
        <div class="info-panel">
            <h3 style="color: #1f2937; margin-bottom: 8px; font-size: 18px; font-weight: 600;">
                📋 Plotted Locations (${markers.length})
            </h3>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 16px;">
                Click on any marker on the map to see detailed information.
            </p>
            <div class="locations-grid">
                ${markers.map((marker, index) => `
                <div class="location-card">
                    <div class="color-dot color-${marker.color}"></div>
                    <div class="location-info">
                        <h4>${index + 1}. ${marker.originalAddress}</h4>
                        <p>${marker.notes}</p>
                    </div>
                </div>
                `).join('')}
            </div>
        </div>
    </div>

    <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js" 
            integrity="sha512-XQoYMqMTK8LvdxXYG3nZ448hOEQiglfqkJs1NOQV44cWnUrBc8PkAOcXy20w0vlaXaVUearIOBhiXZ5V3ynxwA==" 
            crossorigin=""></script>
    <script>
        // Initialize the map
        const map = L.map('map').setView([${mapCenter[0]}, ${mapCenter[1]}], ${mapZoom});
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(map);
        
        // Color icon URLs
        const iconUrls = {
            red: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            blue: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            green: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
            purple: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
            orange: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
            yellow: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
            violet: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
            grey: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
            black: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-black.png'
        };
        
        // Create custom icon function
        function createColorIcon(color) {
            return L.icon({
                iconUrl: iconUrls[color] || iconUrls.red,
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            });
        }
        
        // Add markers
        ${markers.map((marker, index) => `
        L.marker([${marker.position[0]}, ${marker.position[1]}], {
            icon: createColorIcon('${marker.color}')
        }).bindPopup(\`
            <div class="popup-content">
                <strong>${marker.originalAddress.replace(/'/g, "\\'")}</strong>
                <div class="popup-field">
                    <strong>Location:</strong> ${marker.address.replace(/'/g, "\\'").substring(0, 100)}${marker.address.length > 100 ? '...' : ''}
                </div>
                <div class="popup-field">
                    <strong>Notes:</strong> ${marker.notes.replace(/'/g, "\\'").replace(/\n/g, '<br>')}
                </div>
                <div class="popup-field">
                    <strong>Color:</strong> <span class="color-badge color-${marker.color}">${marker.color}</span>
                </div>
                <div class="popup-coordinates">
                    Coordinates: ${marker.position[0].toFixed(4)}, ${marker.position[1].toFixed(4)}
                </div>
            </div>
        \`, { maxWidth: 300 }).addTo(map);
        `).join('')}
        
        // Fit map to show all markers if there are multiple
        ${markers.length > 1 ? `
        const group = new L.featureGroup([${markers.map((_, index) => `markers_${index}`).join(', ')}]);
        map.fitBounds(group.getBounds().pad(0.1));
        ` : ''}
        
        // Add scale control
        L.control.scale().addTo(map);
        
        console.log('Map loaded with ${markers.length} markers');
    </script>
</body>
</html>`

    const dataBlob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(dataBlob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `interactive-map-${new Date().toISOString().split('T')[0]}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setProcessingStatus(`Exported standalone HTML with ${markers.length} locations`)
    setTimeout(() => setProcessingStatus(''), 3000)
  }

  const importFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importedData = JSON.parse(e.target?.result as string)
        processImportedData(importedData)
      } catch (error) {
        console.error('Error importing map data:', error)
        setProcessingStatus(`Import error: ${error instanceof Error ? error.message : 'Invalid file format'}`)
        setTimeout(() => setProcessingStatus(''), 5000)
      }
    }
    
    reader.readAsText(file)
    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const importFromPaste = () => {
    try {
      const importedData = JSON.parse(importData)
      processImportedData(importedData)
      setShowImportModal(false)
      setImportData('')
    } catch (error) {
      setProcessingStatus(`Import error: ${error instanceof Error ? error.message : 'Invalid JSON format'}`)
      setTimeout(() => setProcessingStatus(''), 5000)
    }
  }

  const processImportedData = (importedData: any) => {
    // Validate the imported data structure
    if (!importedData.markers || !Array.isArray(importedData.markers)) {
      throw new Error('Invalid map data format')
    }

    // Validate each marker has required fields and generate ID if missing
    const validMarkers = importedData.markers.filter((marker: any) => 
      marker.position && 
      Array.isArray(marker.position) && 
      marker.position.length === 2 &&
      typeof marker.address === 'string' &&
      typeof marker.notes === 'string' &&
      typeof marker.originalAddress === 'string' &&
      typeof marker.color === 'string'
    ).map((marker: any) => ({
      ...marker,
      id: marker.id || generateLocationId(marker.originalAddress) // Generate ID if missing
    }))

    // Update agent state with imported markers
    if (agent.setState) {
      agent.setState({
        markers: validMarkers,
        mapCenter: importedData.mapCenter || (validMarkers.length > 0 ? validMarkers[0].position : [51.505, -0.09]),
        mapZoom: importedData.mapZoom || (validMarkers.length > 0 ? 10 : 2)
      });
    }
    
    // Restore map view if available
    if (importedData.mapCenter && importedData.mapZoom) {
      setMapCenter(importedData.mapCenter)
      setMapZoom(importedData.mapZoom)
    } else if (validMarkers.length > 0) {
      setMapCenter(validMarkers[0].position)
      setMapZoom(10)
    }

    setProcessingStatus(`Successfully imported ${validMarkers.length} locations`)
    setTimeout(() => setProcessingStatus(''), 3000)
  }

  const clearMarkers = () => {
    // Update agent state to clear all markers
    if (agent.setState) {
      agent.setState({
        markers: [],
        mapCenter: [51.505, -0.09],
        mapZoom: 2
      });
      setProcessingStatus('Cleared all locations from the map');
    } else {
      setProcessingStatus('Cannot clear markers - agent not connected');
    }
    setTimeout(() => setProcessingStatus(''), 3000);
  }

  // Commented out - example JSON (now using programmatic functions)
  // const exampleJson = `[...]`

  return (
    <div className="space-y-4">
      {/* Instructions and JSON Input - COMMENTED OUT FOR PROGRAMMATIC INTERFACE */}
      {/* 
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3">📋 JSON Format Instructions</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <p><strong>Required format:</strong> Array of objects with the following fields:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><code className="bg-gray-200 px-1 rounded">address</code> (required): Street address, landmark, or location</li>
              <li><code className="bg-gray-200 px-1 rounded">notes</code> (required): Custom description or notes</li>
              <li><code className="bg-gray-200 px-1 rounded">color</code> (optional): Pin color - defaults to "red"</li>
            </ul>
            <div className="mt-3">
              <p><strong>Available colors:</strong></p>
              <div className="flex flex-wrap gap-1 mt-1">
                {markerColors.map(color => (
                  <span key={color} className={`px-2 py-1 text-xs rounded text-white bg-${color === 'yellow' ? 'yellow-500' : color === 'grey' ? 'gray-500' : color}-600`}>
                    {color}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-3">📝 JSON Input</h3>
          <div className="space-y-3">
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder={exampleJson}
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-black text-sm font-mono"
              disabled={isProcessing}
            />
            
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={processJsonInput}
                disabled={isProcessing || !jsonInput.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Processing...' : 'Plot Locations'}
              </button>
              <button
                onClick={clearMarkers}
                disabled={isProcessing}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
              <button
                onClick={() => setJsonInput(exampleJson)}
                disabled={isProcessing}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Load Example
              </button>
            </div>

            {processingStatus && (
              <div className={`text-sm p-2 rounded ${
                processingStatus.startsWith('Error') 
                  ? 'bg-red-100 text-red-700' 
                  : processingStatus.startsWith('Successfully')
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {processingStatus}
              </div>
            )}
          </div>
        </div>
      </div>
      */}

      {/* Function Testing Controls */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-gray-800 mb-3">🧪 Function Testing</h3>
        <div className="text-sm text-gray-700 mb-3">
          <p>Test the core location management functions (these will be exposed to the chatbot)</p>
        </div>
        <div className="flex gap-2 flex-wrap mb-3">
          <button
            onClick={() => {
              const locations = listPlottedLocations();
              console.log('All locations:', locations);
              setProcessingStatus(`Listed ${locations.length} locations (check console)`);
              setTimeout(() => setProcessingStatus(''), 3000);
            }}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
          >
            📋 List All Locations
          </button>
          <button
            onClick={async () => {
              const result = await addLocationByAddress('Central Park, New York', 'Famous park in Manhattan', 'green');
              let statusMessage = result.message;
              if (!result.success && result.error) {
                console.error('Test location add error:', result.error);
                statusMessage += ` (${result.error.name})`;
              }
              setProcessingStatus(statusMessage);
              setTimeout(() => setProcessingStatus(''), 5000);
            }}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
          >
            ➕ Add Test Location
          </button>
          {markers.length > 0 && (
            <button
              onClick={() => {
                const firstId = markers[0].id;
                const location = getLocationById(firstId);
                console.log('Found location:', location);
                setProcessingStatus(`Retrieved location: ${location?.originalAddress || 'Not found'} (check console)`);
                setTimeout(() => setProcessingStatus(''), 3000);
              }}
              className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
            >
              🔍 Get First Location by ID
            </button>
          )}
          {markers.length > 0 && (
            <button
              onClick={() => {
                const firstId = markers[0].id;
                const result = deleteLocationById(firstId);
                let statusMessage = result.message;
                if (!result.success && result.error) {
                  console.error('Test location delete error:', result.error);
                  statusMessage += ` (${result.error.name})`;
                }
                setProcessingStatus(statusMessage);
                setTimeout(() => setProcessingStatus(''), 5000);
              }}
              className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
            >
              🗑️ Delete First Location
            </button>
          )}
          <button
            onClick={clearMarkers}
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
          >
            🧹 Clear All Locations
          </button>
        </div>
        
        {/* Status Display */}
        {processingStatus && (
          <div className={`text-sm p-2 rounded ${
            processingStatus.startsWith('Error') 
              ? 'bg-red-100 text-red-700' 
              : processingStatus.startsWith('Successfully')
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {processingStatus}
          </div>
        )}
      </div>

      {/* Import/Export Controls */}
      <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
        <h3 className="font-semibold text-gray-800 mb-3">💾 Import/Export Map Data</h3>
        <div className="text-sm text-gray-700 mb-3">
          <p>Save and load your geolocated map data (includes coordinates, addresses, notes, and colors)</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={prepareExportData}
            disabled={markers.length === 0}
            className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            📤 Export Map Data ({markers.length} locations)
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600"
          >
            📥 Import Map Data
          </button>
          <label className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 cursor-pointer">
            📁 Upload File
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={importFromFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">📤 Export Map Data</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Map Data JSON:
              </label>
              <textarea
                value={exportData}
                readOnly
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md text-black text-sm font-mono bg-gray-50"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={downloadMapData}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                💾 Download JSON
              </button>
              <button
                onClick={exportAsHTML}
                className="px-4 py-2 bg-purple-500 text-white rounded-md hover:bg-purple-600"
              >
                📄 Export as HTML
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">📥 Import Map Data</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste Map Data JSON:
              </label>
              <textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste your exported map data JSON here..."
                className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md text-black text-sm font-mono"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowImportModal(false)
                  setImportData('')
                }}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={importFromPaste}
                disabled={!importData.trim()}
                className="px-4 py-2 bg-indigo-500 text-white rounded-md hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                📥 Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map - Much Larger */}
      <div className="h-[90vh] w-full rounded-lg overflow-hidden shadow-lg">
        <MapContainer 
          center={mapCenter} 
          zoom={mapZoom} 
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          <MapUpdater center={mapCenter} zoom={mapZoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {markers.map((marker) => (
            <Marker 
              key={marker.id} 
              position={marker.position}
              icon={createColoredIcon(marker.color)}
            >
              <Popup>
                <div className="text-sm max-w-xs">
                  <div className="font-semibold text-gray-900 mb-2">
                    {marker.originalAddress}
                  </div>
                  <div className="text-gray-700 mb-2">
                    <strong>Location:</strong> {marker.address}
                  </div>
                  <div className="text-gray-700 mb-2">
                    <strong>Notes:</strong> {marker.notes}
                  </div>
                  <div className="text-gray-700 mb-2">
                    <strong>Color:</strong> <span className={`px-2 py-1 text-xs rounded text-white bg-${marker.color === 'yellow' ? 'yellow-500' : marker.color === 'grey' ? 'gray-500' : marker.color}-600`}>{marker.color}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">
                    ID: {marker.id}
                  </div>
                  <div className="text-xs text-gray-500">
                    Coordinates: {marker.position[0].toFixed(4)}, {marker.position[1].toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Markers Summary */}
      {markers.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-semibold text-gray-800 mb-2">
            📍 Plotted Locations ({markers.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
            {markers.map((marker, index) => (
              <div key={marker.id} className="text-sm bg-white p-2 rounded border">
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full bg-${marker.color === 'yellow' ? 'yellow-500' : marker.color === 'grey' ? 'gray-500' : marker.color}-600`}></span>
                  {index + 1}. {marker.originalAddress}
                </div>
                <div className="text-gray-600 text-xs mt-1">
                  {marker.notes}
                </div>
                <div className="text-gray-500 text-xs mt-1 font-mono">
                  ID: {marker.id}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
