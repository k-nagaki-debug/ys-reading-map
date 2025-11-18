let map;
let markers = [];
let infoWindows = [];
let currentHospitalMarker = null;
let allHospitals = [];
let filteredHospitals = [];

// Initialize Google Map
async function initMap() {
    // Default center: Kumamoto City
    const center = { lat: 32.7898, lng: 130.7417 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: center,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: true,
        fullscreenControl: true
    });

    // マップクリックで施設登録は不要
    // ユーザーは「新規作成」ボタンから登録フォームを開く

    // Load existing facilities
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
        
        const matchesDepartment = !selectedDepartment || hospital.departments === selectedDepartment;
        
        return matchesSearch && matchesDepartment;
    });
    
    // Update markers on map
    updateMarkers();
    
    // Update facility list
    displayHospitalList(filteredHospitals);
}

// Update markers based on filtered facilities
function updateMarkers() {
    // Clear existing markers
    markers.forEach(marker => marker.setMap(null));
    infoWindows.forEach(infoWindow => infoWindow.close());
    markers = [];
    infoWindows = [];
    
    // Add markers for filtered facilities (only if they have coordinates)
    filteredHospitals.forEach(hospital => {
        if (hospital.latitude && hospital.longitude) {
            addMarker(hospital);
        }
    });
    
    // Center map on filtered facilities with coordinates
    const facilitiesWithCoords = filteredHospitals.filter(f => f.latitude && f.longitude);
    if (facilitiesWithCoords.length > 0) {
        centerMapOnHospitals(facilitiesWithCoords);
    }
}

// Show facility form when map is clicked
function showHospitalForm(latLng, hospitalData = null) {
    const modal = document.getElementById('hospital-modal');
    const form = document.getElementById('hospital-form');
    const modalTitle = document.getElementById('modal-title');
    
    // Reset form
    form.reset();
    
    // Reset image preview
    document.getElementById('image-preview').classList.add('hidden');
    document.getElementById('hospital-image-url').value = '';
    
    if (hospitalData) {
        // Edit mode
        modalTitle.textContent = '病院情報編集';
        document.getElementById('hospital-id').value = hospitalData.id;
        document.getElementById('hospital-name').value = hospitalData.name;
        document.getElementById('hospital-departments').value = hospitalData.departments || '';
        document.getElementById('hospital-description').value = hospitalData.description || '';
        document.getElementById('hospital-address').value = hospitalData.address || '';
        document.getElementById('hospital-phone').value = hospitalData.phone || '';
        document.getElementById('hospital-website').value = hospitalData.website || '';
        document.getElementById('hospital-lat').value = hospitalData.latitude || '';
        document.getElementById('hospital-lng').value = hospitalData.longitude || '';
        
        // Set modality checkboxes
        document.getElementById('hospital-has-ct').checked = hospitalData.has_ct === 1 || hospitalData.has_ct === true;
        document.getElementById('hospital-has-mri').checked = hospitalData.has_mri === 1 || hospitalData.has_mri === true;
        document.getElementById('hospital-has-pet').checked = hospitalData.has_pet === 1 || hospitalData.has_pet === true;
        document.getElementById('hospital-has-remote-reading').checked = hospitalData.has_remote_reading === 1 || hospitalData.has_remote_reading === true;
        document.getElementById('hospital-remote-reading-provider').value = hospitalData.remote_reading_provider || '';
        document.getElementById('hospital-emergency').checked = hospitalData.emergency === 1 || hospitalData.emergency === true;
        
        // Show existing image if available
        if (hospitalData.image_url) {
            document.getElementById('hospital-image-url').value = hospitalData.image_url;
            document.getElementById('preview-img').src = hospitalData.image_url;
            document.getElementById('image-preview').classList.remove('hidden');
        }
    } else {
        // Create mode
        modalTitle.textContent = '新規病院登録';
        // 緯度・経度は空のまま（ユーザーが入力可能）
        document.getElementById('hospital-lat').value = '';
        document.getElementById('hospital-lng').value = '';
        
        // Reset all checkboxes
        document.getElementById('hospital-has-ct').checked = false;
        document.getElementById('hospital-has-mri').checked = false;
        document.getElementById('hospital-has-pet').checked = false;
        document.getElementById('hospital-has-remote-reading').checked = false;
        document.getElementById('hospital-remote-reading-provider').value = '';
        document.getElementById('hospital-emergency').checked = false;
        
        // マップクリックから呼び出された場合は一時マーカーを削除
        if (currentHospitalMarker) {
            currentHospitalMarker.setMap(null);
            currentHospitalMarker = null;
        }
    }
    
    modal.classList.remove('hidden');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('hospital-modal');
    modal.classList.add('hidden');
    
    // Remove temporary marker
    if (currentHospitalMarker) {
        currentHospitalMarker.setMap(null);
        currentHospitalMarker = null;
    }
}

// Handle image file selection
document.getElementById('hospital-image').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('preview-img').src = e.target.result;
        document.getElementById('image-preview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
});

// Remove image
function removeImage() {
    document.getElementById('hospital-image').value = '';
    document.getElementById('hospital-image-url').value = '';
    document.getElementById('image-preview').classList.add('hidden');
}

// Handle form submission
document.getElementById('hospital-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const facilityId = document.getElementById('hospital-id').value;
    const imageFile = document.getElementById('hospital-image').files[0];
    let imageUrl = document.getElementById('hospital-image-url').value;
    
    try {
        // Upload image if a new file is selected
        if (imageFile) {
            const formData = new FormData();
            formData.append('image', imageFile);
            
            const uploadResponse = await axios.post('/api/upload-image', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            if (uploadResponse.data.success) {
                imageUrl = uploadResponse.data.data.imageUrl;
            }
        }
        
        const latValue = document.getElementById('hospital-lat').value;
        const lngValue = document.getElementById('hospital-lng').value;
        
        const hospitalData = {
            name: document.getElementById('hospital-name').value,
            departments: document.getElementById('hospital-departments').value,
            description: document.getElementById('hospital-description').value,
            address: document.getElementById('hospital-address').value,
            phone: document.getElementById('hospital-phone').value,
            website: document.getElementById('hospital-website').value,
            latitude: latValue ? parseFloat(latValue) : null,
            longitude: lngValue ? parseFloat(lngValue) : null,
            image_url: imageUrl || null,
            has_ct: document.getElementById('hospital-has-ct').checked ? 1 : 0,
            has_mri: document.getElementById('hospital-has-mri').checked ? 1 : 0,
            has_pet: document.getElementById('hospital-has-pet').checked ? 1 : 0,
            has_remote_reading: document.getElementById('hospital-has-remote-reading').checked ? 1 : 0,
            remote_reading_provider: document.getElementById('hospital-remote-reading-provider').value || null,
            emergency: document.getElementById('hospital-emergency').checked ? 1 : 0
        };
        
        let response;
        if (hospitalId) {
            // Update existing facility
            response = await axios.put(`/api/hospitals/${facilityId}`, hospitalData);
        } else {
            // Create new facility
            response = await axios.post('/api/hospitals', hospitalData);
        }
        
        if (response.data.success) {
            closeModal();
            await loadHospitals();
            alert(hospitalId ? '病院情報を更新しました' : '病院を登録しました');
        }
    } catch (error) {
        console.error('Error saving hospital:', error);
        alert('病院の保存に失敗しました');
    }
});

// Load all facilities
async function loadHospitals() {
    try {
        const response = await axios.get('/api/hospitals');
        
        if (response.data.success) {
            allHospitals = response.data.data;
            filteredHospitals = [...allHospitals];
            
            // Clear existing markers
            markers.forEach(marker => marker.setMap(null));
            infoWindows.forEach(infoWindow => infoWindow.close());
            markers = [];
            infoWindows = [];
            
            // Add markers for each facility (only if they have coordinates)
            filteredHospitals.forEach(hospital => {
                if (hospital.latitude && hospital.longitude) {
                    addMarker(hospital);
                }
            });
            
            // Update facility list
            displayHospitalList(filteredHospitals);
            
            // Center map on facilities with coordinates
            const facilitiesWithCoords = filteredHospitals.filter(f => f.latitude && f.longitude);
            if (facilitiesWithCoords.length > 0) {
                centerMapOnHospitals(facilitiesWithCoords);
            }
            // マップ位置はデフォルトのまま（熊本市中心）
        }
    } catch (error) {
        console.error('Error loading facilities:', error);
    }
}

// Center map on all facilities
function centerMapOnHospitals(facilities) {
    if (facilities.length === 0) return;
    
    if (facilities.length === 1) {
        // Single facility: center on it with zoom 15
        const hospital = facilities[0];
        map.setCenter({ lat: hospital.latitude, lng: hospital.longitude });
        map.setZoom(15);
    } else {
        // Multiple facilities: fit bounds to show all markers
        const bounds = new google.maps.LatLngBounds();
        facilities.forEach(f => {
            bounds.extend({ lat: f.latitude, lng: f.longitude });
        });
        map.fitBounds(bounds);
    }
}

// Add marker to map
function addMarker(hospital) {
    const position = { lat: hospital.latitude, lng: hospital.longitude };
    
    // Determine marker icon
    let markerIcon;
    if (hospital.remote_reading_provider && hospital.remote_reading_provider.includes('ワイズ・リーディング')) {
        // Special icon for Y's READING hospitals
        markerIcon = {
            url: '/static/ys-reading-pin.png',
            scaledSize: new google.maps.Size(40, 40),
            origin: new google.maps.Point(0, 0),
            anchor: new google.maps.Point(20, 40)
        };
    } else {
        // Red marker for saved facilities
        markerIcon = {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png'
        };
    }
    
    const marker = new google.maps.Marker({
        position: position,
        map: map,
        title: hospital.name,
        icon: markerIcon
    });
    
    // Create info window content
    const infoContent = createPopupContent(hospital);
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
    
    // Store facility data with marker
    marker.hospitalData = facility;
}

// Create popup content
function createPopupContent(hospital) {
    const categoryBadge = hospital.departments ? 
        `<span style="display: inline-block; background-color: #dbeafe; color: #1e40af; font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 0.25rem;">${hospital.departments}</span>` : '';
    
    const imageHtml = hospital.image_url ? 
        `<img src="${hospital.image_url}" alt="${hospital.name}" style="width: 100%; max-height: 150px; object-fit: cover; border-radius: 0.5rem; margin-top: 0.5rem;">` : '';
    
    // Create modality badges
    const modalityBadges = [];
    if (hospital.has_ct) modalityBadges.push('CT');
    if (hospital.has_mri) modalityBadges.push('MRI');
    if (hospital.has_pet) modalityBadges.push('PET');
    const modalityHtml = modalityBadges.length > 0 
        ? `<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #4b5563;"><strong>医療機器:</strong> ${modalityBadges.map(m => `<span style="display: inline-block; background: #3b82f6; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-right: 4px;">${m}</span>`).join('')}</p>`
        : '';
    
    // Create remote reading info
    const remoteReadingHtml = hospital.has_remote_reading
        ? `<p style="font-size: 0.875rem; color: #4b5563;"><strong>遠隔読影サービス:</strong> ${hospital.remote_reading_provider || '対応'}</p>`
        : '';
    
    return `
        <div style="max-width: 300px;">
            <h3 style="font-size: 1.125rem; font-weight: bold; margin-bottom: 0.5rem; color: #1f2937;">${hospital.name}</h3>
            ${categoryBadge}
            ${imageHtml}
            ${modalityHtml}
            ${remoteReadingHtml}
            ${hospital.description ? `<p style="margin-top: 0.5rem; color: #374151;">${hospital.description}</p>` : ''}
            ${hospital.address ? `<p style="margin-top: 0.5rem; font-size: 0.875rem; color: #4b5563;"><i class="fas fa-map-marker-alt"></i> ${hospital.address}</p>` : ''}
            ${hospital.phone ? `<p style="font-size: 0.875rem; color: #4b5563;"><i class="fas fa-phone"></i> ${hospital.phone}</p>` : ''}
            ${hospital.website ? `<p style="font-size: 0.875rem;"><a href="${hospital.website}" target="_blank" style="color: #2563eb; text-decoration: underline;"><i class="fas fa-external-link-alt"></i> ウェブサイト</a></p>` : ''}
            <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
                <button onclick="editFacility(${hospital.id})" style="font-size: 0.875rem; background-color: #3b82f6; color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: none; cursor: pointer;">
                    <i class="fas fa-edit"></i> 編集
                </button>
                <button onclick="deleteHospital(${hospital.id})" style="font-size: 0.875rem; background-color: #ef4444; color: white; padding: 0.25rem 0.75rem; border-radius: 0.25rem; border: none; cursor: pointer;">
                    <i class="fas fa-trash"></i> 削除
                </button>
            </div>
        </div>
    `;
}

// Display facility list
function displayHospitalList(facilities) {
    const listContainer = document.getElementById('hospital-list');
    
    if (facilities.length === 0) {
        listContainer.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">登録された施設はありません</p>';
        return;
    }
    
    listContainer.innerHTML = facilities.map(hospital => {
        const hasCoords = hospital.latitude && hospital.longitude;
        const onclickAttr = hasCoords ? `onclick="focusOnHospital(${hospital.latitude}, ${hospital.longitude})"` : '';
        const cursorClass = hasCoords ? 'cursor-pointer' : '';
        
        return `
        <div class="facility-card bg-gray-50 p-4 rounded-lg border border-gray-200 ${cursorClass}"
             ${onclickAttr}>
            ${hospital.image_url ? `<img src="${hospital.image_url}" alt="${hospital.name}" class="w-full h-40 object-cover rounded-lg mb-3">` : ''}
            <h3 class="text-lg font-bold text-gray-800 mb-1">${hospital.name}</h3>
            ${hospital.departments ? `<span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">${hospital.departments}</span>` : ''}
            ${!hasCoords ? `<span class="inline-block bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded mb-2"><i class="fas fa-map-marker-slash"></i> 位置情報なし</span>` : ''}
            ${hospital.description ? `<p class="text-sm text-gray-600 mt-2 line-clamp-2">${hospital.description}</p>` : ''}
            ${hospital.address ? `<p class="text-xs text-gray-500 mt-2"><i class="fas fa-map-marker-alt"></i> ${hospital.address}</p>` : ''}
            <div class="mt-3 flex gap-2">
                <button onclick="event.stopPropagation(); editFacility(${hospital.id})" 
                        class="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">
                    <i class="fas fa-edit"></i> 編集
                </button>
                <button onclick="event.stopPropagation(); deleteHospital(${hospital.id})" 
                        class="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600">
                    <i class="fas fa-trash"></i> 削除
                </button>
            </div>
        </div>
        `;
    }).join('');
}

// Focus on facility when clicked from list
function focusOnHospital(lat, lng) {
    map.setCenter({ lat: lat, lng: lng });
    map.setZoom(15);
    
    // Find and open the marker's info window
    const marker = markers.find(m => m.hospitalData && 
        m.hospitalData.latitude === lat && m.hospitalData.longitude === lng);
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

// Edit facility
async function editFacility(hospitalId) {
    try {
        const response = await axios.get(`/api/hospitals/${facilityId}`);
        
        if (response.data.success) {
            const hospital = response.data.data;
            const latLng = { lat: hospital.latitude, lng: hospital.longitude };
            showHospitalForm(latLng, hospital);
        }
    } catch (error) {
        console.error('Error loading facility:', error);
        alert('施設情報の取得に失敗しました');
    }
}

// Delete facility
async function deleteHospital(hospitalId) {
    if (!confirm('この施設を削除してもよろしいですか？')) {
        return;
    }
    
    try {
        const response = await axios.delete(`/api/hospitals/${facilityId}`);
        
        if (response.data.success) {
            await loadHospitals();
            alert('施設を削除しました');
        }
    } catch (error) {
        console.error('Error deleting facility:', error);
        alert('施設の削除に失敗しました');
    }
}

// Show new facility form (without map click)
function showNewHospitalForm() {
    showHospitalForm(null);
}

// Geocode address to get coordinates
async function geocodeAddress() {
    const addressInput = document.getElementById('hospital-address');
    const address = addressInput.value.trim();
    
    if (!address) {
        alert('住所を入力してください');
        return;
    }
    
    try {
        // Use Google Maps Geocoding API
        const geocoder = new google.maps.Geocoder();
        
        geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK' && results[0]) {
                const location = results[0].geometry.location;
                const lat = location.lat();
                const lng = location.lng();
                
                // Set coordinates
                document.getElementById('hospital-lat').value = lat;
                document.getElementById('hospital-lng').value = lng;
                
                // Show marker on map
                if (currentHospitalMarker) {
                    currentHospitalMarker.setMap(null);
                }
                
                currentHospitalMarker = new google.maps.Marker({
                    position: { lat: lat, lng: lng },
                    map: map,
                    icon: {
                        url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    },
                    animation: google.maps.Animation.DROP
                });
                
                // Center map on the location
                map.setCenter({ lat: lat, lng: lng });
                map.setZoom(15);
                
                alert(`座標を取得しました！\n緯度: ${lat.toFixed(6)}\n経度: ${lng.toFixed(6)}`);
            } else {
                let errorMessage = '住所から座標を取得できませんでした。';
                if (status === 'ZERO_RESULTS') {
                    errorMessage = '指定された住所が見つかりませんでした。住所を確認してください。';
                } else if (status === 'OVER_QUERY_LIMIT') {
                    errorMessage = 'APIの利用制限に達しました。しばらく待ってから再度お試しください。';
                } else if (status === 'REQUEST_DENIED') {
                    errorMessage = 'ジオコーディングAPIが無効です。APIキーの設定を確認してください。';
                }
                alert(errorMessage);
                console.error('Geocoding error:', status, results);
            }
        });
    } catch (error) {
        console.error('Error during geocoding:', error);
        alert('ジオコーディング中にエラーが発生しました。');
    }
}

// Make functions available globally
window.closeModal = closeModal;
window.showNewHospitalForm = showNewHospitalForm;
window.editFacility = editFacility;
window.deleteHospital = deleteHospital;
window.focusOnHospital = focusOnHospital;
window.removeImage = removeImage;
window.geocodeAddress = geocodeAddress;
