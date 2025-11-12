let map;
let markers = [];
let currentFacilityMarker = null;

// Initialize Google Map
async function initMap() {
    // Default center: Tokyo
    const center = { lat: 35.6812, lng: 139.7671 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: center,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true,
    });

    // Add click listener to map
    map.addListener('click', (event) => {
        showFacilityForm(event.latLng);
    });

    // Load existing facilities
    await loadFacilities();
}

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
        document.getElementById('facility-lat').value = latLng.lat();
        document.getElementById('facility-lng').value = latLng.lng();
        
        // Show temporary marker
        if (currentFacilityMarker) {
            currentFacilityMarker.setMap(null);
        }
        currentFacilityMarker = new google.maps.Marker({
            position: latLng,
            map: map,
            icon: {
                url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
            },
            animation: google.maps.Animation.DROP
        });
    }
    
    modal.classList.remove('hidden');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('facility-modal');
    modal.classList.add('hidden');
    
    // Remove temporary marker
    if (currentFacilityMarker) {
        currentFacilityMarker.setMap(null);
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
            markers.forEach(marker => marker.setMap(null));
            markers = [];
            
            // Add markers for each facility
            facilities.forEach(facility => {
                addMarker(facility);
            });
            
            // Update facility list
            displayFacilityList(facilities);
        }
    } catch (error) {
        console.error('Error loading facilities:', error);
    }
}

// Add marker to map
function addMarker(facility) {
    const position = { lat: facility.latitude, lng: facility.longitude };
    
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: facility.name,
        animation: google.maps.Animation.DROP
    });
    
    // Create info window
    const infoWindow = new google.maps.InfoWindow({
        content: createInfoWindowContent(facility)
    });
    
    marker.addListener('click', () => {
        // Close all other info windows
        markers.forEach(m => {
            if (m.infoWindow) {
                m.infoWindow.close();
            }
        });
        infoWindow.open(map, marker);
    });
    
    marker.infoWindow = infoWindow;
    markers.push(marker);
}

// Create info window content
function createInfoWindowContent(facility) {
    const categoryBadge = facility.category ? 
        `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${facility.category}</span>` : '';
    
    return `
        <div style="max-width: 300px;">
            <h3 class="text-lg font-bold mb-2">${facility.name}</h3>
            ${categoryBadge}
            ${facility.description ? `<p class="mt-2 text-gray-700">${facility.description}</p>` : ''}
            ${facility.address ? `<p class="mt-2 text-sm text-gray-600"><i class="fas fa-map-marker-alt"></i> ${facility.address}</p>` : ''}
            ${facility.phone ? `<p class="text-sm text-gray-600"><i class="fas fa-phone"></i> ${facility.phone}</p>` : ''}
            ${facility.website ? `<p class="text-sm"><a href="${facility.website}" target="_blank" class="text-blue-600 hover:underline"><i class="fas fa-external-link-alt"></i> ウェブサイト</a></p>` : ''}
            <div class="mt-3 flex gap-2">
                <button onclick="editFacility(${facility.id})" class="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
                    <i class="fas fa-edit"></i> 編集
                </button>
                <button onclick="deleteFacility(${facility.id})" class="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
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
             onclick="focusOnFacility(${facility.latitude}, ${facility.longitude}, ${facility.id})">
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
function focusOnFacility(lat, lng, facilityId) {
    map.setCenter({ lat, lng });
    map.setZoom(15);
    
    // Find and click the marker
    const marker = markers.find(m => {
        const pos = m.getPosition();
        return pos.lat() === lat && pos.lng() === lng;
    });
    
    if (marker) {
        google.maps.event.trigger(marker, 'click');
    }
}

// Edit facility
async function editFacility(facilityId) {
    try {
        const response = await axios.get(`/api/facilities/${facilityId}`);
        
        if (response.data.success) {
            const facility = response.data.data;
            const latLng = new google.maps.LatLng(facility.latitude, facility.longitude);
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
window.initMap = initMap;
window.closeModal = closeModal;
window.editFacility = editFacility;
window.deleteFacility = deleteFacility;
window.focusOnFacility = focusOnFacility;
