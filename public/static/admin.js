let allFacilities = [];
let filteredFacilities = [];

// Load facilities on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadFacilities();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Real-time search
    document.getElementById('search-input').addEventListener('input', applyFilters);
    document.getElementById('category-filter').addEventListener('change', applyFilters);
    document.getElementById('sort-select').addEventListener('change', applyFilters);
    
    // Form submission
    document.getElementById('facility-form').addEventListener('submit', handleFormSubmit);
    
    // Image file selection
    document.getElementById('facility-image').addEventListener('change', handleImageSelection);
}

// Load all facilities
async function loadFacilities() {
    try {
        const response = await axios.get('/api/facilities');
        
        if (response.data.success) {
            allFacilities = response.data.data;
            filteredFacilities = [...allFacilities];
            applyFilters();
            updateStats();
        }
    } catch (error) {
        console.error('Error loading facilities:', error);
        showNotification('施設の読み込みに失敗しました', 'error');
    }
}

// Apply filters and sorting
function applyFilters() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const categoryFilter = document.getElementById('category-filter').value;
    const sortOption = document.getElementById('sort-select').value;
    
    // Filter
    filteredFacilities = allFacilities.filter(facility => {
        const matchesSearch = !searchTerm || 
            facility.name.toLowerCase().includes(searchTerm) ||
            (facility.description && facility.description.toLowerCase().includes(searchTerm)) ||
            (facility.address && facility.address.toLowerCase().includes(searchTerm));
        
        const matchesCategory = !categoryFilter || facility.category === categoryFilter;
        
        return matchesSearch && matchesCategory;
    });
    
    // Sort
    filteredFacilities.sort((a, b) => {
        switch (sortOption) {
            case 'created_desc':
                return new Date(b.created_at) - new Date(a.created_at);
            case 'created_asc':
                return new Date(a.created_at) - new Date(b.created_at);
            case 'name_asc':
                return a.name.localeCompare(b.name, 'ja');
            case 'name_desc':
                return b.name.localeCompare(a.name, 'ja');
            default:
                return 0;
        }
    });
    
    displayFacilities();
}

// Display facilities in table
function displayFacilities() {
    const tbody = document.getElementById('facilities-table-body');
    const noData = document.getElementById('no-data');
    
    if (filteredFacilities.length === 0) {
        tbody.innerHTML = '';
        noData.classList.remove('hidden');
        return;
    }
    
    noData.classList.add('hidden');
    
    tbody.innerHTML = filteredFacilities.map(facility => {
        const categoryBadge = facility.category 
            ? `<span class="status-badge bg-blue-100 text-blue-800">${facility.category}</span>`
            : '<span class="text-gray-400">-</span>';
        
        const formattedDate = new Date(facility.created_at).toLocaleString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        return `
            <tr class="table-row">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">#${facility.id}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        ${facility.image_url ? `<img src="${facility.image_url}" alt="${facility.name}" class="w-16 h-16 object-cover rounded">` : '<div class="w-16 h-16 bg-gray-200 rounded flex items-center justify-center"><i class="fas fa-image text-gray-400"></i></div>'}
                        <div>
                            <div class="text-sm font-medium text-gray-900">${facility.name}</div>
                            ${facility.description ? `<div class="text-xs text-gray-500 truncate max-w-xs">${facility.description}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${categoryBadge}</td>
                <td class="px-6 py-4 text-sm text-gray-900">
                    ${facility.address ? `<div class="max-w-xs truncate">${facility.address}</div>` : '<span class="text-gray-400">-</span>'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${facility.phone || '<span class="text-gray-400">-</span>'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="viewOnMap(${facility.latitude}, ${facility.longitude})" 
                            class="text-green-600 hover:text-green-900 mr-3" title="地図で表示">
                        <i class="fas fa-map-marker-alt"></i>
                    </button>
                    <button onclick="editFacility(${facility.id})" 
                            class="text-blue-600 hover:text-blue-900 mr-3" title="編集">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteFacility(${facility.id})" 
                            class="text-red-600 hover:text-red-900" title="削除">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Update statistics
function updateStats() {
    const totalCount = allFacilities.length;
    const tourismCount = allFacilities.filter(f => f.category === '観光').length;
    const restaurantCount = allFacilities.filter(f => f.category === '飲食').length;
    const otherCount = allFacilities.filter(f => !f.category || 
        !['観光', '飲食'].includes(f.category)).length;
    
    document.getElementById('total-count').textContent = totalCount;
    document.getElementById('tourism-count').textContent = tourismCount;
    document.getElementById('restaurant-count').textContent = restaurantCount;
    document.getElementById('other-count').textContent = otherCount;
}

// Handle image file selection
function handleImageSelection(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('preview-img').src = e.target.result;
        document.getElementById('image-preview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

// Remove image
function removeImage() {
    document.getElementById('facility-image').value = '';
    document.getElementById('facility-image-url').value = '';
    document.getElementById('image-preview').classList.add('hidden');
}

// Show add modal
function showAddModal() {
    const modal = document.getElementById('facility-modal');
    const form = document.getElementById('facility-form');
    const modalTitle = document.getElementById('modal-title');
    
    form.reset();
    modalTitle.textContent = '新規施設登録';
    
    // Reset image preview
    document.getElementById('image-preview').classList.add('hidden');
    document.getElementById('facility-image-url').value = '';
    
    // Set default coordinates (Tokyo)
    document.getElementById('facility-lat').value = '35.6812';
    document.getElementById('facility-lng').value = '139.7671';
    
    modal.classList.remove('hidden');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('facility-modal');
    modal.classList.add('hidden');
}

// Edit facility
async function editFacility(facilityId) {
    try {
        const response = await axios.get(`/api/facilities/${facilityId}`);
        
        if (response.data.success) {
            const facility = response.data.data;
            const modal = document.getElementById('facility-modal');
            const modalTitle = document.getElementById('modal-title');
            
            modalTitle.textContent = '施設情報編集';
            
            document.getElementById('facility-id').value = facility.id;
            document.getElementById('facility-name').value = facility.name;
            document.getElementById('facility-category').value = facility.category || '';
            document.getElementById('facility-description').value = facility.description || '';
            document.getElementById('facility-address').value = facility.address || '';
            document.getElementById('facility-phone').value = facility.phone || '';
            document.getElementById('facility-website').value = facility.website || '';
            document.getElementById('facility-lat').value = facility.latitude;
            document.getElementById('facility-lng').value = facility.longitude;
            
            // Reset image preview
            document.getElementById('image-preview').classList.add('hidden');
            document.getElementById('facility-image-url').value = '';
            
            // Show existing image if available
            if (facility.image_url) {
                document.getElementById('facility-image-url').value = facility.image_url;
                document.getElementById('preview-img').src = facility.image_url;
                document.getElementById('image-preview').classList.remove('hidden');
            }
            
            modal.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading facility:', error);
        showNotification('施設情報の取得に失敗しました', 'error');
    }
}

// Delete facility
async function deleteFacility(facilityId) {
    if (!confirm('この施設を削除してもよろしいですか？\nこの操作は取り消せません。')) {
        return;
    }
    
    try {
        const response = await axios.delete(`/api/facilities/${facilityId}`);
        
        if (response.data.success) {
            showNotification('施設を削除しました', 'success');
            await loadFacilities();
        }
    } catch (error) {
        console.error('Error deleting facility:', error);
        showNotification('施設の削除に失敗しました', 'error');
    }
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const facilityId = document.getElementById('facility-id').value;
    const imageFile = document.getElementById('facility-image').files[0];
    let imageUrl = document.getElementById('facility-image-url').value;
    
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
        
        const facilityData = {
            name: document.getElementById('facility-name').value,
            category: document.getElementById('facility-category').value,
            description: document.getElementById('facility-description').value,
            address: document.getElementById('facility-address').value,
            phone: document.getElementById('facility-phone').value,
            website: document.getElementById('facility-website').value,
            latitude: parseFloat(document.getElementById('facility-lat').value),
            longitude: parseFloat(document.getElementById('facility-lng').value),
            image_url: imageUrl || null
        };
        
        let response;
        if (facilityId) {
            // Update existing facility
            response = await axios.put(`/api/facilities/${facilityId}`, facilityData);
            showNotification('施設情報を更新しました', 'success');
        } else {
            // Create new facility
            response = await axios.post('/api/facilities', facilityData);
            showNotification('施設を登録しました', 'success');
        }
        
        if (response.data.success) {
            closeModal();
            await loadFacilities();
        }
    } catch (error) {
        console.error('Error saving facility:', error);
        showNotification('施設の保存に失敗しました', 'error');
    }
}

// View facility on map
function viewOnMap(lat, lng) {
    window.open(`/?lat=${lat}&lng=${lng}&zoom=15`, '_blank');
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white z-50 transform transition-all duration-300 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }`;
    notification.innerHTML = `
        <div class="flex items-center gap-2">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Make functions available globally
window.showAddModal = showAddModal;
window.closeModal = closeModal;
window.editFacility = editFacility;
window.deleteFacility = deleteFacility;
window.viewOnMap = viewOnMap;
window.applyFilters = applyFilters;
window.removeImage = removeImage;
