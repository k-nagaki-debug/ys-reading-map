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
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const sortSelect = document.getElementById('sort-select');
    const facilityForm = document.getElementById('facility-form');
    const facilityImage = document.getElementById('facility-image');
    
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', applyFilters);
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', applyFilters);
    }
    
    // Form submission
    if (facilityForm) {
        facilityForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Image file selection
    if (facilityImage) {
        facilityImage.addEventListener('change', handleImageSelection);
    }
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
    
    // Clear coordinates (no default values)
    document.getElementById('facility-lat').value = '';
    document.getElementById('facility-lng').value = '';
    
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
            document.getElementById('facility-lat').value = facility.latitude || '';
            document.getElementById('facility-lng').value = facility.longitude || '';
            
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
    
    console.log('Form submitted');
    
    const facilityId = document.getElementById('facility-id').value;
    const imageFile = document.getElementById('facility-image').files[0];
    let imageUrl = document.getElementById('facility-image-url').value;
    
    console.log('Facility ID:', facilityId);
    console.log('Image file:', imageFile);
    
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
        
        console.log('Facility data:', facilityData);
        
        let response;
        if (facilityId) {
            // Update existing facility
            console.log('Updating facility...');
            response = await axios.put(`/api/facilities/${facilityId}`, facilityData);
            showNotification('施設情報を更新しました', 'success');
        } else {
            // Create new facility
            console.log('Creating new facility...');
            response = await axios.post('/api/facilities', facilityData);
            showNotification('施設を登録しました', 'success');
        }
        
        console.log('Response:', response.data);
        
        if (response.data.success) {
            closeModal();
            await loadFacilities();
        }
    } catch (error) {
        console.error('Error saving facility:', error);
        console.error('Error details:', error.response?.data || error.message);
        showNotification('施設の保存に失敗しました: ' + (error.response?.data?.error || error.message), 'error');
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

// ==================== Import Functions ====================

let importData = [];

// Show import modal
function showImportModal() {
    document.getElementById('import-modal').classList.remove('hidden');
    resetImport();
}

// Close import modal
function closeImportModal() {
    document.getElementById('import-modal').classList.add('hidden');
    resetImport();
}

// Reset import state
function resetImport() {
    importData = [];
    document.getElementById('import-file').value = '';
    document.getElementById('import-step-1').classList.remove('hidden');
    document.getElementById('import-step-2').classList.add('hidden');
    document.getElementById('import-loading').classList.add('hidden');
    document.getElementById('import-errors').classList.add('hidden');
}

// Parse uploaded file
async function parseImportFile() {
    const fileInput = document.getElementById('import-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('error', 'ファイルを選択してください');
        return;
    }
    
    // Show loading
    document.getElementById('import-step-1').classList.add('hidden');
    document.getElementById('import-loading').classList.remove('hidden');
    
    try {
        const data = await readFile(file);
        importData = data;
        
        // Show preview
        document.getElementById('import-loading').classList.add('hidden');
        document.getElementById('import-step-2').classList.remove('hidden');
        document.getElementById('preview-count').textContent = importData.length;
        
        renderPreview();
        validateData();
    } catch (error) {
        document.getElementById('import-loading').classList.add('hidden');
        document.getElementById('import-step-1').classList.remove('hidden');
        showNotification('error', 'ファイルの読み込みに失敗しました: ' + error.message);
    }
}

// Read file (CSV or Excel)
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                let result = [];
                
                if (file.name.endsWith('.csv')) {
                    // Parse CSV
                    result = parseCSV(data);
                } else if (file.name.endsWith('.xlsx')) {
                    // Parse Excel using SheetJS
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    result = XLSX.utils.sheet_to_json(firstSheet);
                } else {
                    reject(new Error('対応していないファイル形式です'));
                    return;
                }
                
                resolve(result);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        
        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    });
}

// Parse CSV manually
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const obj = {};
        
        headers.forEach((header, index) => {
            obj[header] = values[index] ? values[index].trim() : '';
        });
        
        result.push(obj);
    }
    
    return result;
}

// Render preview table
function renderPreview() {
    const tbody = document.getElementById('preview-table-body');
    tbody.innerHTML = '';
    
    importData.forEach((row, index) => {
        const tr = document.createElement('tr');
        tr.className = 'border-t hover:bg-gray-50';
        tr.innerHTML = `
            <td class="px-4 py-2 text-sm text-gray-600">${index + 1}</td>
            <td class="px-4 py-2 text-sm font-medium">${row.name || '-'}</td>
            <td class="px-4 py-2 text-sm">${row.category || '-'}</td>
            <td class="px-4 py-2 text-sm">${row.latitude || '-'}</td>
            <td class="px-4 py-2 text-sm">${row.longitude || '-'}</td>
            <td class="px-4 py-2 text-sm">${row.address || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Validate data
function validateData() {
    const errors = [];
    
    importData.forEach((row, index) => {
        if (!row.name) {
            errors.push(`行${index + 1}: 施設名が必要です`);
        }
        if (!row.latitude || isNaN(parseFloat(row.latitude))) {
            errors.push(`行${index + 1}: 緯度が無効です`);
        }
        if (!row.longitude || isNaN(parseFloat(row.longitude))) {
            errors.push(`行${index + 1}: 経度が無効です`);
        }
    });
    
    if (errors.length > 0) {
        const errorList = document.getElementById('error-list');
        errorList.innerHTML = errors.map(err => `<li>• ${err}</li>`).join('');
        document.getElementById('import-errors').classList.remove('hidden');
    } else {
        document.getElementById('import-errors').classList.add('hidden');
    }
    
    return errors.length === 0;
}

// Execute import
async function executeImport() {
    if (!validateData()) {
        showNotification('error', 'データにエラーがあります。修正してください。');
        return;
    }
    
    // Show loading
    document.getElementById('import-step-2').classList.add('hidden');
    document.getElementById('import-loading').classList.remove('hidden');
    
    try {
        const response = await axios.post('/api/facilities/import', {
            facilities: importData
        });
        
        if (response.data.success) {
            showNotification('success', response.data.message);
            closeImportModal();
            await loadFacilities();
        } else {
            throw new Error(response.data.error);
        }
    } catch (error) {
        document.getElementById('import-loading').classList.add('hidden');
        document.getElementById('import-step-2').classList.remove('hidden');
        showNotification('error', 'インポートに失敗しました: ' + (error.response?.data?.error || error.message));
    }
}

// Geocode address to get coordinates (for admin page)
async function geocodeAddress() {
    const addressInput = document.getElementById('facility-address');
    const address = addressInput.value.trim();
    
    if (!address) {
        showNotification('error', '住所を入力してください');
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
                document.getElementById('facility-lat').value = lat;
                document.getElementById('facility-lng').value = lng;
                
                showNotification('success', `座標を取得しました！ 緯度: ${lat.toFixed(6)}, 経度: ${lng.toFixed(6)}`);
            } else {
                let errorMessage = '住所から座標を取得できませんでした。';
                if (status === 'ZERO_RESULTS') {
                    errorMessage = '指定された住所が見つかりませんでした。住所を確認してください。';
                } else if (status === 'OVER_QUERY_LIMIT') {
                    errorMessage = 'APIの利用制限に達しました。しばらく待ってから再度お試しください。';
                } else if (status === 'REQUEST_DENIED') {
                    errorMessage = 'ジオコーディングAPIが無効です。APIキーの設定を確認してください。';
                }
                showNotification('error', errorMessage);
                console.error('Geocoding error:', status, results);
            }
        });
    } catch (error) {
        console.error('Error during geocoding:', error);
        showNotification('error', 'ジオコーディング中にエラーが発生しました。');
    }
}

// Make functions available globally
window.showAddModal = showAddModal;
window.closeModal = closeModal;
window.editFacility = editFacility;
window.deleteFacility = deleteFacility;
window.viewOnMap = viewOnMap;
window.applyFilters = applyFilters;
window.removeImage = removeImage;
window.showImportModal = showImportModal;
window.closeImportModal = closeImportModal;
window.parseImportFile = parseImportFile;
window.executeImport = executeImport;
window.resetImport = resetImport;
window.geocodeAddress = geocodeAddress;
