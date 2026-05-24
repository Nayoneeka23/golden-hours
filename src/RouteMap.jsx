import { useEffect, useRef } from 'react';

export default function RouteMap() {
    // We use a ref to target the map container div
    const mapRef = useRef(null);
    // We use a ref to store the map instance so we don't initialize it twice
    const mapInstance = useRef(null);

    useEffect(() => {
        // 1. Check if the map is already initialized to prevent errors
        if (!mapInstance.current && mapRef.current) {

            // 2. Initialize the map (Coordinates set to Sophia Antipolis based on your search)
            mapInstance.current = window.L.map(mapRef.current).setView([43.6163, 7.0552], 14);

            // 3. Add the OpenStreetMap visual tiles
            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(mapInstance.current);

            // 4. Add a pin/marker to the start location
            const startMarker = window.L.marker([43.6163, 7.0552]).addTo(mapInstance.current);
            startMarker.bindPopup("<b>Sophia Antipolis</b><br>Your trip starts here.").openPopup();
        }

        // 5. Cleanup function: remove the map when the component unmounts
        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []); // The empty array ensures this only runs once when the page loads

    return (
        <div className="map-section">
            {/* This div is where Leaflet will inject the interactive map */}
            <div
                ref={mapRef}
                style={{ height: '400px', width: '100%', borderRadius: '12px', zIndex: 1 }}
            ></div>
        </div>
    );
}