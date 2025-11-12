let map;
let markers = [];
let currentFacilityMarker = null;

// Initialize Leaflet Map
async function initMap() {
    // Default center: Tokyo (will be updated after loading facilities)
    const center = [35.6812, 139.7671];
    
    map = L.map('map').setView(center, 12);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add click listener to map
    map.on('click', (event) => {
        showFacilityForm(event.latlng);
    });

    // Load existing facilities and center map
    await loadFacilities();
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', initMap);

// Show facility form when map is clicked
function showFacilityForm(latLng, facilityData = null) {
    const modal = document.getElementById('facility-modal');
    const form = document.getElementById('facility-form');
    const modalTitle = document.getElementById('modal-title');
    
    // Reset form
    form.reset();
    
    if (facilityData) {
        // Edit mode
        modalTitle.textContent = '施設情報編集';
        document.getElementById('facility-id').value = facilityData.id;
        document.getElementById('facility-name').value = facilityData.name;
        document.getElementById('facility-category').value = facilityData.category || '';
        document.getElementById('facility-description').value = facilityData.description || '';
        document.getElementById('facility-address').value = facilityData.address || '';
        document.getElementById('facility-phone').value = facilityData.phone || '';
        document.getElementById('facility-website').value = facilityData.website || '';
        document.getElementById('facility-lat').value = facilityData.latitude;
        document.getElementById('facility-lng').value = facilityData.longitude;
    } else {
        // Create mode
        modalTitle.textContent = '新規施設登録';
        document.getElementById('facility-lat').value = latLng.lat;
        document.getElementById('facility-lng').value = latLng.lng;
        
        // Show temporary marker
        if (currentFacilityMarker) {
            map.removeLayer(currentFacilityMarker);
        }
        
        const blueIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        });
        
        currentFacilityMarker = L.marker([latLng.lat, latLng.lng], { icon: blueIcon }).addTo(map);
    }
    
    modal.classList.remove('hidden');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('facility-modal');
    modal.classList.add('hidden');
    
    // Remove temporary marker
    if (currentFacilityMarker) {
        map.removeLayer(currentFacilityMarker);
        currentFacilityMarker = null;
    }
}

// Handle form submission
document.getElementById('facility-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const facilityId = document.getElementById('facility-id').value;
    const facilityData = {
        name: document.getElementById('facility-name').value,
        category: document.getElementById('facility-category').value,
        description: document.getElementById('facility-description').value,
        address: document.getElementById('facility-address').value,
        phone: document.getElementById('facility-phone').value,
        website: document.getElementById('facility-website').value,
        latitude: parseFloat(document.getElementById('facility-lat').value),
        longitude: parseFloat(document.getElementById('facility-lng').value)
    };
    
    try {
        let response;
        if (facilityId) {
            // Update existing facility
            response = await axios.put(`/api/facilities/${facilityId}`, facilityData);
        } else {
            // Create new facility
            response = await axios.post('/api/facilities', facilityData);
        }
        
        if (response.data.success) {
            closeModal();
            await loadFacilities();
            alert(facilityId ? '施設情報を更新しました' : '施設を登録しました');
        }
    } catch (error) {
        console.error('Error saving facility:', error);
        alert('施設の保存に失敗しました');
    }
});

// Load all facilities
async function loadFacilities() {
    try {
        const response = await axios.get('/api/facilities');
        
        if (response.data.success) {
            const facilities = response.data.data;
            
            // Clear existing markers
            markers.forEach(marker => map.removeLayer(marker));
            markers = [];
            
            // Add markers for each facility
            facilities.forEach(facility => {
                addMarker(facility);
            });
            
            // Update facility list
            displayFacilityList(facilities);
            
            // Center map on facilities if any exist
            if (facilities.length > 0) {
                centerMapOnFacilities(facilities);
            }
        }
    } catch (error) {
        console.error('Error loading facilities:', error);
    }
}

// Center map on all facilities
function centerMapOnFacilities(facilities) {
    if (facilities.length === 0) return;
    
    if (facilities.length === 1) {
        // Single facility: center on it with zoom 15
        const facility = facilities[0];
        map.setView([facility.latitude, facility.longitude], 15);
    } else {
        // Multiple facilities: fit bounds to show all markers
        const bounds = L.latLngBounds(
            facilities.map(f => [f.latitude, f.longitude])
        );
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Add marker to map
function addMarker(facility) {
    const position = [facility.latitude, facility.longitude];
    
    // Custom red icon for saved facilities
    const redIcon = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
    
    const marker = L.marker(position, { icon: redIcon }).addTo(map);
    
    // Create popup content
    const popupContent = createPopupContent(facility);
    marker.bindPopup(popupContent, { maxWidth: 300 });
    
    markers.push(marker);
}

// Create popup content
function createPopupContent(facility) {
    const categoryBadge = facility.category ? 
        `<span style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${facility.category}</span>` : '';
    
    return `
        <div style="max-width: 300px;">
            <h3 style="font-size: 1.125rem; font-weight: bold; margin-bottom: 0.5rem;">${facility.name}</h3>
            ${categoryBadge}
            ${facility.description ? `<p style="margin-top: 0.5rem; color: #374151;">${facility.description}</p>` : ''}
            ${facility.address ? `<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #4b5563;"><i class="fas fa-map-marker-alt"></i> ${facility.address}</p>` : ''}
            ${facility.phone ? `<p style="font-size: 0.875rem; color: #4b5563;"><i class="fas fa-phone"></i> ${facility.phone}</p>` : ''}
            ${facility.website ? `<p style="font-size: 0.875rem;"><a href="${facility.website}" target="_blank" style="color: #2563eb; text-decoration: underline;"><i class="fas fa-external-link-alt"></i> ウェブサイト</a></p>` : ''}
            <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
                <button onclick="editFacility(${facility.id})" style="font-size: 0.875rem; background-color: #3b82f6; color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: none; cursor: pointer;">
                    <i class="fas fa-edit"></i> 編集
                </button>
                <button onclick="deleteFacility(${facility.id})" style="font-size: 0.875rem; background-color: #ef4444; color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: none; cursor: pointer;">
                    <i class="fas fa-trash"></i> 削除
                </button>
            </div>
        </div>
    `;
}

// Display facility list
function displayFacilityList(facilities) {
    const listContainer = document.getElementById('facility-list');
    
    if (facilities.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">登録された施設はありません</p>';
        return;
    }
    
    listContainer.innerHTML = facilities.map(facility => `
        <div class="facility-card bg-gray-50 p-4 rounded-lg border border-gray-200 cursor-pointer"
             onclick="focusOnFacility(${facility.latitude}, ${facility.longitude})">
            <h3 class="text-lg font-bold text-gray-800 mb-1">${facility.name}</h3>
            ${facility.category ? `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">${facility.category}</span>` : ''}
            ${facility.description ? `<p class="text-sm text-gray-600 mt-2 line-clamp-2">${facility.description}</p>` : ''}
            ${facility.address ? `<p class="text-xs text-gray-500 mt-2"><i class="fas fa-map-marker-alt"></i> ${facility.address}</p>` : ''}
            <div class="mt-3 flex gap-2">
                <button onclick="event.stopPropagation(); editFacility(${facility.id})" 
                        class="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
                    <i class="fas fa-edit"></i> 編集
                </button>
                <button onclick="event.stopPropagation(); deleteFacility(${facility.id})" 
                        class="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
                    <i class="fas fa-trash"></i> 削除
                </button>
            </div>
        </div>
    `).join('');
}

// Focus on facility when clicked from list
function focusOnFacility(lat, lng) {
    map.setView([lat, lng], 15);
    
    // Find and open the marker popup
    const marker = markers.find(m => {
        const pos = m.getLatLng();
        return pos.lat === lat && pos.lng === lng;
    });
    
    if (marker) {
        marker.openPopup();
    }
}

// Edit facility
async function editFacility(facilityId) {
    try {
        const response = await axios.get(`/api/facilities/${facilityId}`);
        
        if (response.data.success) {
            const facility = response.data.data;
            const latLng = { lat: facility.latitude, lng: facility.longitude };
            showFacilityForm(latLng, facility);
        }
    } catch (error) {
        console.error('Error loading facility:', error);
        alert('施設情報の取得に失敗しました');
    }
}

// Delete facility
async function deleteFacility(facilityId) {
    if (!confirm('この施設を削除してもよろしいですか？')) {
        return;
    }
    
    try {
        const response = await axios.delete(`/api/facilities/${facilityId}`);
        
        if (response.data.success) {
            await loadFacilities();
            alert('施設を削除しました');
        }
    } catch (error) {
        console.error('Error deleting facility:', error);
        alert('施設の削除に失敗しました');
    }
}

// Make functions available globally
window.closeModal = closeModal;
window.editFacility = editFacility;
window.deleteFacility = deleteFacility;
window.focusOnFacility = focusOnFacility;
