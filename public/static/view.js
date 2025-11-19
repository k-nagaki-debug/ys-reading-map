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
    const remoteReadingFilter = document.getElementById('map-remote-reading-filter');
    
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    if (remoteReadingFilter) {
        remoteReadingFilter.addEventListener('input', applyFilters);
    }
}

// Apply search and filter
function applyFilters() {
    const searchTerm = document.getElementById('map-search-input')?.value.toLowerCase() || '';
    const remoteReadingTerm = document.getElementById('map-remote-reading-filter')?.value.toLowerCase() || '';
    
    filteredHospitals = allHospitals.filter(hospital => {
        const matchesSearch = !searchTerm || 
            hospital.name.toLowerCase().includes(searchTerm);
        
        const matchesRemoteReading = !remoteReadingTerm || 
            (hospital.remote_reading_provider && hospital.remote_reading_provider.toLowerCase().includes(remoteReadingTerm));
        
        return matchesSearch && matchesRemoteReading;
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
    
    // Determine marker icon
    let markerIcon = undefined;
    if (hospital.remote_reading_provider && hospital.remote_reading_provider.includes('ワイズ・リーディング')) {
        // Special SVG icon for Y's READING hospitals
        markerIcon = {
            url: '/static/ys-reading-pin.svg',
            scaledSize: new google.maps.Size(40, 56),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 56)
        };
    }
    
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: hospital.name,
        animation: google.maps.Animation.DROP,
        icon: markerIcon
    });
    
    // Create modality badges
    const modalityBadges = [];
    if (hospital.has_ct) modalityBadges.push('CT');
    if (hospital.has_mri) modalityBadges.push('MRI');
    if (hospital.has_pet) modalityBadges.push('PET');
    const modalityHtml = modalityBadges.length > 0 
        ? `<div style="margin: 12px 0;">
               <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">医療機器</div>
               <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                   ${modalityBadges.map(m => `<span style="display: inline-block; background: #3b82f6; color: white; padding: 4px 12px; border-radius: 6px; font-size: 12px; font-weight: 500;">${m}</span>`).join('')}
               </div>
           </div>`
        : '';
    
    // Create remote reading info
    const remoteReadingHtml = hospital.has_remote_reading
        ? `<div style="margin: 12px 0; padding: 10px; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
               <div style="font-size: 12px; font-weight: 600; color: #1e40af; margin-bottom: 4px;">遠隔読影サービス</div>
               <div style="font-size: 13px; color: #1e3a8a; font-weight: 500;">${hospital.remote_reading_provider || '対応'}</div>
           </div>`
        : '';
    
    // Create info window content with improved design
    const infoContent = `
        <div style="max-width: 320px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #1f2937; line-height: 1.4; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
                ${hospital.name}
            </h3>
            ${hospital.image_url ? `<img src="${hospital.image_url}" alt="${hospital.name}" style="width: 100%; max-height: 160px; object-fit: cover; border-radius: 8px; margin-bottom: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">` : ''}
            ${hospital.description ? `<div style="margin: 12px 0; padding: 10px; background: #f9fafb; border-radius: 6px; font-size: 13px; color: #4b5563; line-height: 1.6;">${hospital.description}</div>` : ''}
            ${hospital.departments ? `<div style="margin: 12px 0;">
                <div style="font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 6px;">診療科目</div>
                <div style="font-size: 13px; color: #374151; line-height: 1.5;">${hospital.departments}</div>
            </div>` : ''}
            ${modalityHtml}
            ${remoteReadingHtml}
            ${hospital.address || hospital.phone ? `<div style="margin: 12px 0; padding-top: 12px; border-top: 1px solid #e5e7eb;">` : ''}
                ${hospital.address ? `<div style="margin: 8px 0; display: flex; align-items: start;">
                    <span style="font-size: 14px; color: #6b7280; margin-right: 6px;">📍</span>
                    <span style="font-size: 13px; color: #4b5563; line-height: 1.5;">${hospital.address}</span>
                </div>` : ''}
                ${hospital.phone ? `<div style="margin: 8px 0; display: flex; align-items: center;">
                    <span style="font-size: 14px; color: #6b7280; margin-right: 6px;">📞</span>
                    <a href="tel:${hospital.phone}" style="font-size: 13px; color: #3b82f6; text-decoration: none; font-weight: 500;">${hospital.phone}</a>
                </div>` : ''}
            ${hospital.address || hospital.phone ? `</div>` : ''}
            ${hospital.website ? `<div style="margin-top: 12px;">
                <a href="${hospital.website}" target="_blank" style="display: inline-block; background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 500; text-decoration: none; transition: background 0.2s;">
                    🔗 ウェブサイトを開く
                </a>
            </div>` : ''}
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
