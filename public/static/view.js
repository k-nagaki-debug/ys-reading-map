let map;
let markers = [];
let infoWindows = [];
let allHospitals = [];
let filteredHospitals = [];

// Initialize Google Map (Read-only mode)
async function initMap() {
    // Default center: Tokyo
    const center = { lat: 35.6812, lng: 139.7671 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
    });

    // No click listener - read-only mode

    // Load existing hospitals and center map
    await loadHospitals();
    
    // Setup search and filter listeners
    setupSearchAndFilter();
}

// Setup search and filter event listeners
function setupSearchAndFilter() {
    const searchInput = document.getElementById('map-search-input');
    const categoryFilter = document.getElementById('map-category-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }
}

// Apply search and filter
function applyFilters() {
    const searchTerm = document.getElementById('map-search-input')?.value.toLowerCase() || '';
    const selectedDepartment = document.getElementById('map-category-filter')?.value || '';
    
    filteredHospitals = allHospitals.filter(hospital => {
        const matchesSearch = !searchTerm || 
            hospital.name.toLowerCase().includes(searchTerm) ||
            (hospital.description && hospital.description.toLowerCase().includes(searchTerm)) ||
            (hospital.address && hospital.address.toLowerCase().includes(searchTerm));
        
        const matchesDepartment = !selectedDepartment || 
            (hospital.departments && hospital.departments.includes(selectedDepartment));
        
        return matchesSearch && matchesDepartment;
    });
    
    // Update markers on map
    updateMarkers();
    
    // Update hospital list
    displayHospitalList(filteredHospitals);
}

// Update markers based on filtered hospitals
function updateMarkers() {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());
    markers = [];
    infoWindows = [];
    
    // Add markers for filtered hospitals (only if they have coordinates)
    filteredHospitals.forEach(hospital => {
        if (hospital.latitude && hospital.longitude) {
            addMarker(hospital);
        }
    });
    
    // Center map on filtered hospitals with coordinates
    const hospitalsWithCoords = filteredHospitals.filter(h => h.latitude && h.longitude);
    if (hospitalsWithCoords.length > 0) {
        centerMapOnHospitals(hospitalsWithCoords);
    }
}

// Add marker to map (Read-only - no edit functionality)
function addMarker(hospital) {
    const position = { lat: hospital.latitude, lng: hospital.longitude };
    
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: hospital.name,
        animation: google.maps.Animation.DROP,
        icon: hospital.emergency ? 'http://maps.google.com/mapfiles/ms/icons/red-dot.png' : undefined
    });
    
    // Create info window content
    const infoContent = `
        <div style="max-width: 300px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; font-weight: bold; color: #1f2937;">
                ${hospital.name}
                ${hospital.emergency ? '<span style="color: #ef4444; font-size: 12px;">🚑 救急対応</span>' : ''}
            </h3>
            ${hospital.image_url ? `<img src="${hospital.image_url}" alt="${hospital.name}" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 4px; margin-bottom: 10px;">` : ''}
            ${hospital.departments ? `<p style="margin: 5px 0; color: #4b5563;"><strong>診療科目:</strong> ${hospital.departments}</p>` : ''}
            ${hospital.description ? `<p style="margin: 5px 0; color: #6b7280;">${hospital.description}</p>` : ''}
            ${hospital.address ? `<p style="margin: 5px 0; color: #4b5563;"><strong>住所:</strong> ${hospital.address}</p>` : ''}
            ${hospital.phone ? `<p style="margin: 5px 0; color: #4b5563;"><strong>電話:</strong> ${hospital.phone}</p>` : ''}
            ${hospital.business_hours ? `<p style="margin: 5px 0; color: #4b5563;"><strong>診療時間:</strong> ${hospital.business_hours}</p>` : ''}
            ${hospital.closed_days ? `<p style="margin: 5px 0; color: #4b5563;"><strong>休診日:</strong> ${hospital.closed_days}</p>` : ''}
            ${hospital.parking ? `<p style="margin: 5px 0; color: #4b5563;"><strong>駐車場:</strong> ${hospital.parking}</p>` : ''}
            ${hospital.website ? `<p style="margin: 5px 0;"><a href="${hospital.website}" target="_blank" style="color: #3b82f6; text-decoration: underline;">ウェブサイト</a></p>` : ''}
        </div>
    `;
    
    const infoWindow = new google.maps.InfoWindow({
        content: infoContent
    });
    
    marker.addListener('click', () => {
        // Close all other info windows
        infoWindows.forEach(iw => iw.close());
        infoWindow.open(map, marker);
    });
    
    markers.push(marker);
    infoWindows.push(infoWindow);
    
    // Store hospital data with marker
    marker.hospitalData = hospital;
}

// Center map on hospitals
function centerMapOnHospitals(hospitals) {
    if (hospitals.length === 0) return;
    
    if (hospitals.length === 1) {
        map.setCenter({ lat: hospitals[0].latitude, lng: hospitals[0].longitude });
        map.setZoom(14);
    } else {
        const bounds = new google.maps.LatLngBounds();
        hospitals.forEach(h => {
            bounds.extend({ lat: h.latitude, lng: h.longitude });
        });
        map.fitBounds(bounds);
    }
}

// Load hospitals from API
async function loadHospitals() {
    try {
        const response = await axios.get('/api/hospitals');
        
        if (response.data.success) {
            allHospitals = response.data.data;
            filteredHospitals = [...allHospitals];
            
            // Add markers to map (only if they have coordinates)
            allHospitals.forEach(hospital => {
                if (hospital.latitude && hospital.longitude) {
                    addMarker(hospital);
                }
            });
            
            // Center map on hospitals with coordinates
            const hospitalsWithCoords = allHospitals.filter(h => h.latitude && h.longitude);
            if (hospitalsWithCoords.length > 0) {
                centerMapOnHospitals(hospitalsWithCoords);
            }
            // マップ位置はデフォルトのまま（東京中心）
            
            // Display hospital list
            displayHospitalList(allHospitals);
        }
    } catch (error) {
        console.error('Failed to load hospitals:', error);
    }
}

// Display hospital list
function displayHospitalList(hospitals) {
    const listContainer = document.getElementById('hospital-list');
    
    if (!hospitals || hospitals.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full text-center py-8 text-gray-500">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>病院が登録されていません</p>
            </div>
        `;
        return;
    }
    
    listContainer.innerHTML = hospitals.map(hospital => {
        const hasCoords = hospital.latitude && hospital.longitude;
        const onclickAttr = hasCoords ? `onclick="focusOnHospital(${hospital.id})"` : '';
        const cursorClass = hasCoords ? 'cursor-pointer hover:shadow-md' : '';
        
        return `
        <div class="facility-card bg-white rounded-lg shadow p-4 ${cursorClass}" ${onclickAttr}>
            ${hospital.image_url ? `
                <img src="${hospital.image_url}" alt="${hospital.name}" class="w-full h-32 object-cover rounded mb-3">
            ` : ''}
            <h3 class="text-lg font-bold text-gray-800 mb-2">
                ${hospital.name}
                ${hospital.emergency ? '<span class="text-red-500 text-xs ml-1">🚑</span>' : ''}
            </h3>
            ${hospital.departments ? `
                <span class="inline-block px-2 py-1 text-xs font-semibold rounded-full mb-2 bg-blue-100 text-blue-800">
                    ${hospital.departments.split(',')[0]}${hospital.departments.split(',').length > 1 ? ' 他' : ''}
                </span>
            ` : ''}
            ${!hasCoords ? `<span class="inline-block px-2 py-1 text-xs font-semibold rounded-full mb-2 bg-gray-100 text-gray-600"><i class="fas fa-map-marker-slash"></i> 位置情報なし</span>` : ''}
            ${hospital.description ? `<p class="text-sm text-gray-600 mb-2 line-clamp-2">${hospital.description}</p>` : ''}
            ${hospital.business_hours ? `<p class="text-xs text-gray-500 mb-1"><i class="fas fa-clock mr-1"></i>${hospital.business_hours}</p>` : ''}
            ${hospital.address ? `<p class="text-xs text-gray-500"><i class="fas fa-map-marker-alt mr-1"></i>${hospital.address}</p>` : ''}
        </div>
        `;
    }).join('');
}

// Focus on specific hospital
function focusOnHospital(hospitalId) {
    const hospital = allHospitals.find(h => h.id === hospitalId);
    if (hospital && hospital.latitude && hospital.longitude) {
        map.setCenter({ lat: hospital.latitude, lng: hospital.longitude });
        map.setZoom(16);
        
        // Find and open the marker's info window
        const marker = markers.find(m => m.hospitalData && m.hospitalData.id === hospitalId);
        const infoWindow = infoWindows[markers.indexOf(marker)];
        
        if (marker && infoWindow) {
            // Close all other info windows
            infoWindows.forEach(iw => iw.close());
            infoWindow.open(map, marker);
            
            // Add bounce animation
            marker.setAnimation(google.maps.Animation.BOUNCE);
            setTimeout(() => {
                marker.setAnimation(null);
            }, 2000);
        }
    }
}

// Make focusOnHospital available globally
window.focusOnHospital = focusOnHospital;
