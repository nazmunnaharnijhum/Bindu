import React, { useEffect, useRef, useState } from "react";
import Footer from "../Components/Footer/Footer.jsx";
import Navbar from "../Components/Navbar/Navbar.jsx";


export default function BloodBank() {
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const [map, setMap] = useState(null);
  const [markers, setMarkers] = useState([]);

  // Initialize map
  useEffect(() => {
    if (!window.google) return;

    const m = new window.google.maps.Map(mapRef.current, {
      center: { lat: 20.5937, lng: 78.9629 }, // India center
      zoom: 5,
    });

    setMap(m);
  }, []);

  // Autocomplete Search
  useEffect(() => {
    if (!window.google || !map) return;

    const autocomplete = new window.google.maps.places.Autocomplete(
      searchRef.current,
      {
        types: ["geocode"],
        fields: ["geometry", "formatted_address"],
      }
    );

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry) return;

      map.setCenter(place.geometry.location);
      map.setZoom(13);

      findBloodBanks(place.geometry.location);
    });
  }, [map]);

  // Find nearby blood banks
  const findBloodBanks = (location) => {
    if (!window.google || !map) return;

    // Clear old markers
    markers.forEach((m) => m.setMap(null));

    const service = new window.google.maps.places.PlacesService(map);

    service.nearbySearch(
      {
        location,
        radius: 5000, // 5 km radius
        keyword: "blood bank",
      },
      (results, status) => {
        if (status !== "OK" || !results) return;

        const newMarkers = results.map((place) => {
          const marker = new window.google.maps.Marker({
            map,
            position: place.geometry.location,
            title: place.name,
          });

          const info = new window.google.maps.InfoWindow({
            content: `<strong>${place.name}</strong><br>${place.vicinity || ""}`,
          });

          marker.addListener("click", () => info.open(map, marker));

          return marker;
        });

        setMarkers(newMarkers);
      }
    );
  };

  // Use My Location
  const locateMe = () => {
    if (!navigator.geolocation) return alert("Location not supported!");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };

        map.setCenter(location);
        map.setZoom(14);

        findBloodBanks(location);
      },
      () => alert("Please enable location access!")
    );
  };

  return (
    
   <div>
    <Navbar/>    
    <div 
    
      className="w-screen min-h-screen bg-[#8A0302] text-white flex flex-col items-center justify-start pt-28"
      style={{ paddingBottom: "40px" }}
    >
      <h1 className="text-3xl font-bold mb-4">Nearby Blood Banks</h1>

      {/* Search Input */}
      <input
        ref={searchRef}
        type="text"
        placeholder="Search location..."
        className="w-80 px-4 py-2 mb-4 rounded-lg text-black"
      />

      {/* Locate Me Button */}
      <button
        onClick={locateMe}
        className="px-5 py-2 bg-[#E8D8C4] text-[#561C24] rounded-lg font-semibold mb-4"
      >
        Use My Location
      </button>

      {/* Map */}
      <div
        ref={mapRef}
        id="map"
        className="w-[90%] h-[70vh] rounded-xl shadow-lg border border-[#C7B7A3]"
        style={{ background: "#fff" }}
      ></div>
    </div>
    <Footer/>
   </div>
  );
}
