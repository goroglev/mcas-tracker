// --- Global State ---
let entries = [];
let charts = {}; // To hold chart instances
let notes = [];

let medicationsList = [];
let supplementsList = [];
let foodsList = [];


// --- Utility Functions ---
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    document.querySelector(`.nav-btn[data-tab="${tabName}"]`).classList.add('active');

    // --- THE KEY FIX: Render charts AFTER the tab is visible ---
    if (tabName === 'analysis') {
        // Use setTimeout to ensure the container is visible before rendering
        setTimeout(() => renderAnalysisCharts(), 50); // Small delay
    } else if (tabName === 'dashboard') {
        setTimeout(() => {
            const selectedSubstance = document.getElementById('trendSubstanceFilter').value;
            renderDashboardCharts(selectedSubstance);
        }, 0);
    }

}

function initializeFormState() {
    // Hide high stress text input by default
    const highStressGroup = document.getElementById('highStressGroup');
    const highStressCheckbox = document.getElementById('highStressCheckbox');
    if (highStressGroup) {

    }

    // Clear any existing values
    const highStressText = document.getElementById('highStressText');
    if (highStressText) {
        highStressText.value = '';
    }

    // Ensure checkbox is unchecked
    if (highStressCheckbox) {
        highStressCheckbox.checked = false;
    }

}

function resetCustomTextFields() {
    const highStressCheckbox = document.getElementById('highStressCheckbox');
    const highStressGroup = document.getElementById('highStressGroup');
    const highStressText = document.getElementById('highStressText');

    if (highStressCheckbox && !highStressCheckbox.checked) {
        if (highStressGroup) highStressGroup.style.display = 'none';
        if (highStressText) highStressText.value = '';
    }
}

function normalizeSubstanceType(type) {
    const mapping = {
        'Food': 'food',
        'Medication': 'medication',
        'Supplement': 'supplement'
    };
    return mapping[type] || (type || '').toLowerCase();
}

async function loadEntries() {
    const res = await fetch('/api/entries');
    const rawEntries = await res.json();
    
    // ✅ Normalize substanceType after loading
    entries = rawEntries.map(entry => ({
        ...entry,
        substanceType: normalizeSubstanceType(entry.substanceType)
    }));
    entries.sort((a, b) => new Date(`${b.entryDate}T${b.entryTime}`) - new Date(`${a.entryDate}T${a.entryTime}`));
    
    // Also load notes
    await loadNotes();
    await loadSubstances();
    
    renderFilteredHistory();
    updateDashboard();
    populateSubstanceFilter();
    setTimeout(() => renderDashboardCharts(), 50);
    initializeFormState();
}


async function loadNotes() {
    try {
        const res = await fetch('/api/notes');
        notes = await res.json();
        notes.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (err) {
        console.error('Error loading notes:', err);
        notes = [];
    }
}

function showNoteModal(noteId = null) {
    const modal = document.getElementById('noteModal');
    const title = document.getElementById('noteModalTitle');
    const form = document.getElementById('noteForm');
    
    if (noteId) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
            title.textContent = 'Edit Reflection';
            document.getElementById('editNoteId').value = note.id;
            document.getElementById('noteDate').value = note.date;
            document.getElementById('noteText').value = note.text;
            document.getElementById('saveNoteBtn').textContent = 'Update Reflection';
        }
    } else {
        title.textContent = 'Add Reflection';
        form.reset();
        document.getElementById('noteDate').value = new Date().toISOString().split('T');
        document.getElementById('saveNoteBtn').textContent = 'Save Reflection';
    }
    
    modal.style.display = 'block';
}

function hideNoteModal() {
    document.getElementById('noteModal').style.display = 'none';
    document.getElementById('noteForm').reset();
    document.getElementById('editNoteId').value = '';
}

function renderNotesInHistory(container) {
    notes.forEach(note => {
        const noteDiv = document.createElement('div');
        noteDiv.className = 'note-entry';
        noteDiv.innerHTML = `
            <div class="note-date">📝 ${note.date}</div>
            <div class="note-actions">
                <button onclick="showNoteModal('${note.id}')" title="Edit">✏️</button>
                <button onclick="deleteNote('${note.id}')" title="Delete">🗑️</button>
            </div>
            <div class="note-text">${escapeHtml(note.text)}</div>
        `;
        container.appendChild(noteDiv);
    });
}

async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this reflection?')) return;
    
    try {
        await fetch(`/api/notes/id/${noteId}`, { method: 'DELETE' });
        await loadNotes();
        renderFilteredHistory();
    } catch (err) {
        console.error('Error deleting note:', err);
    }
}

function duplicateNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    // Show modal with current date and duplicated text
    showNoteModal();
    document.getElementById('noteDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('noteText').value = note.text;
    document.getElementById('saveNoteBtn').textContent = 'Save Reflection';
}

function renderFilteredHistory() {
    const category = document.getElementById('categoryFilter').value;
    const search = document.getElementById('searchFilter').value.toLowerCase();
    let filtered = entries.filter(e => {
        // ✅ Use new structure for filtering
        const matchSearch = Object.values(e).some(v => String(v).toLowerCase().includes(search));
        const matchCategory = !category ||
            (category === 'Medication' && e.substanceType === 'medication') ||
            (category === 'Supplement' && e.substanceType === 'supplement') ||
            (category === 'Food' && e.substanceType === 'food');
        return matchSearch && matchCategory;
    });
    renderHistoryTable(filtered);
}

function renderHistoryTable(list) {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    
    // Combine entries and notes, sorted by date
    const combined = [
        ...list.map(entry => ({
            ...entry,
            type: 'entry',
            sortDate: new Date(`${entry.entryDate}T${entry.entryTime}`)
        })),
        ...(notes || []).map(note => ({
            ...note,
            type: 'note',
            sortDate: new Date(note.date)
        }))
    ].sort((a, b) => b.sortDate - a.sortDate);
    
    if (!combined.length) {
        tbody.innerHTML = `<tr><td colspan="6">No entries or reflections found.</td></tr>`;
        return;
    }

    combined.forEach(item => {
        if (item.type === 'note') {
            // Render note/reflection
            const noteRow = document.createElement('tr');
            noteRow.className = 'note-row';
            noteRow.innerHTML = `
                <td colspan="6" class="note-cell">
                    <div class="note-entry">
                        <div class="note-date">📝 Reflection - ${item.date}</div>
                        <div class="note-actions">
                            <button onclick="showNoteModal('${item.id}')" class="edit-btn">Edit</button>
                            <button onclick="event.preventDefault(); event.stopPropagation(); deleteNote('${item.id}'); return false;" class="delete" type="button">Delete</button>
                            <button onclick="duplicateNote('${item.id}')" class="duplicate-btn">Duplicate</button>
                        </div>
                        <div class="note-text">${escapeHtml(item.text)}</div>
                    </div>
                </td>
            `;
            tbody.appendChild(noteRow);
        } else {
            // Render regular entry (your existing code)
            const row = document.createElement('tr');
// In the regular entry rendering section, change this line:
row.innerHTML = `
    <td data-label="Date/Time">${item.entryDate} ${item.entryTime}</td>
    <td data-label="Item">${escapeHtml(item.substanceName || 'Unknown')}</td>
    <td data-label="Amount">${escapeHtml(item.amount)}</td>
    <td data-label="Symptoms">${Array.isArray(item.postDoseSymptoms) ? escapeHtml(item.postDoseSymptoms.join(', ')) : ''}</td>
    <td data-label="Severity">${item.symptomSeverity}</td>
    <td data-label="Actions">
        <button class="edit-btn" data-id="${item.id}">Edit</button>
        <button class="duplicate-btn" data-id="${item.id}">Duplicate</button>
        <button class="delete" data-id="${item.id}">Delete</button>
    </td>
`;

            tbody.appendChild(row);
            
            // Add remarks row
            const remarksRow = document.createElement('tr');
            remarksRow.className = 'remarks-row';
            const remarksContent = item.remarks ? escapeHtml(item.remarks.toString()) : '<em>No remarks</em>';
            remarksRow.innerHTML = `<td colspan="6"><div class="remarks-container">${remarksContent}</div></td>`;
            tbody.appendChild(remarksRow);
        }
    });
}

function updateDashboard() {
    // Total entries
    const totalEntriesElement = document.getElementById('totalEntries');
    if (totalEntriesElement) {
        totalEntriesElement.textContent = entries.length;
    }
    
    // Today's entries
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntriesElement = document.getElementById('todayEntries');
    if (todayEntriesElement) {
        todayEntriesElement.textContent = entries.filter(e => e.entryDate === todayStr).length;
    }
    
    // Average severity
    const severities = entries.map(e => parseInt(e.symptomSeverity)).filter(n => !isNaN(n));
    const avgSeverityElement = document.getElementById('avgSeverity');
    if (avgSeverityElement) {
        avgSeverityElement.textContent = severities.length ? 
            (severities.reduce((a, b) => a + b, 0) / severities.length).toFixed(1) : '0.0';
    }
    
    // Most tracked item - completely rewritten
    const mostTrackedElement = document.getElementById('mostTracked');
    if (mostTrackedElement) {
        const substanceCounts = {};
        
        // Count each substance
        for (const entry of entries) {
            if (entry.substanceName && entry.substanceName.trim()) {
                const name = entry.substanceName.trim();
                substanceCounts[name] = (substanceCounts[name] || 0) + 1;
            }
        }
        
        // Find the most frequent substance
        let maxCount = 0;
        let mostTrackedSubstance = '';
        
        for (const [substance, count] of Object.entries(substanceCounts)) {
            if (count > maxCount) {
                maxCount = count;
                mostTrackedSubstance = substance;
            }
        }
        
        // Set the display text
        mostTrackedElement.textContent = mostTrackedSubstance ? 
            `${mostTrackedSubstance} (${maxCount})` : 'None';
    }
}

function renderDashboardCharts(substance = 'all') {

    if (charts.dashboardSeverity) charts.dashboardSeverity.destroy();
    const canvas = document.getElementById('severityChart');
    if (!canvas) return;

    const chartTitle = substance === 'all' ? 'Overall Severity Over Time' : `Severity for ${substance}`;
    charts.dashboardSeverity = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: getSeverityChartData(substance),
        options: { responsive: true, plugins: { title: { display: true, text: chartTitle } } }

    });
}

function renderAnalysisCharts() {
    if (charts.analysisSeverity) charts.analysisSeverity.destroy();
    if (charts.symptom) charts.symptom.destroy();

    const severityCanvas = document.getElementById('analysisSeverityChart');
    if (severityCanvas) {
        charts.analysisSeverity = new Chart(severityCanvas.getContext('2d'), {
            type: 'line',
            data: getSeverityChartData('all'),
            options: { responsive: true, plugins: { title: { display: true, text: 'Overall Severity Trend' } } }
        });
    }

    const symptomCanvas = document.getElementById('symptomChart');
    if (symptomCanvas) {
        charts.symptom = new Chart(symptomCanvas.getContext('2d'), {
            type: 'bar',
            data: getSymptomChartData(),
            options: { responsive: true, plugins: { title: { display: true, text: 'Symptom Frequency' } } }
        });
    }
}

function getSeverityChartData(substance = 'all') {
    let dataSet = [...entries];
    if (substance !== 'all') {
        // ✅ Use new structure
        dataSet = dataSet.filter(e => e.substanceName === substance);
    }
    dataSet.sort((a, b) => new Date(`${a.entryDate}T${a.entryTime}`) - new Date(`${b.entryDate}T${b.entryTime}`));
    return {
        labels: dataSet.map(e => `${e.entryDate} ${e.entryTime}`),
        datasets: [{ label: 'Severity', data: dataSet.map(e => parseInt(e.symptomSeverity)), borderColor: 'rgb(50, 184, 198)', fill: false, tension: 0.1 }]
    };
}


function getSymptomChartData() {
    const symptomCounts = {};
    entries.forEach(e => {
        (Array.isArray(e.postDoseSymptoms) ? e.postDoseSymptoms : []).forEach(s => {
            symptomCounts[s] = (symptomCounts[s] || 0) + 1;
        });
    });
    return {
        labels: Object.keys(symptomCounts),
        datasets: [{ label: 'Count', data: Object.values(symptomCounts), backgroundColor: 'rgba(50,184,198,0.5)' }]
    };
}

function getEnvironmentalFactors() {

    const factors = Array.from(document.querySelectorAll('#environmentalFactors input[type="checkbox"]:checked')).map(c => c.value);
    const highStressCheckbox = document.getElementById('highStressCheckbox');
    const highStressText = document.getElementById('highStressText');

    if (highStressCheckbox && highStressCheckbox.checked && highStressText && highStressText.value.trim()) {
        // If High Stress is checked and text is entered, format it
        return factors.map(factor => factor === 'High Stress' ? `High Stress: ${highStressText.value.trim()}` : factor);
    }

    // The original code had 'checked' here, which is likely a typo. It should return the 'factors' array if no high stress text is present.
    return factors;
}

function clearForm() {
    document.getElementById('entryForm').reset();
    
    // ❌ Remove this line - customItemGroup no longer exists
    // document.getElementById('customItemGroup').style.display = 'none';
    
    // ✅ Reset new substance fields instead
    const newSubstanceGroup = document.getElementById('newSubstanceGroup');
    if (newSubstanceGroup) newSubstanceGroup.style.display = 'none';
    
    const substanceName = document.getElementById('substanceName');
    if (substanceName) {
        substanceName.disabled = true;
        substanceName.innerHTML = '<option value="">First select type...</option>';
    }

    document.getElementById('severityValue').textContent = '1';
    document.getElementById('editId').value = '';
    document.querySelector('#entryForm button[type="submit"]').textContent = 'Save Entry';

    // Clear high stress fields
    const highStressGroup = document.getElementById('highStressGroup');
    const highStressText = document.getElementById('highStressText');
    if (highStressGroup) highStressGroup.style.display = 'none';
    if (highStressText) highStressText.value = '';

    resetCustomTextFields();
}


function duplicateEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    
    clearForm();

    // Set current date and time
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    // NO editId - this creates a new entry
    document.getElementById('editId').value = '';
    document.getElementById('entryDate').value = currentDate;
    document.getElementById('entryTime').value = currentTime;

    // ✅ Set new substance fields instead of old ones
    if (entry.substanceType) {
        document.getElementById('substanceType').value = entry.substanceType;
        populateSubstanceDropdown(entry.substanceType);
        
        // Wait for dropdown to populate, then set the value
        setTimeout(() => {
            if (entry.substanceName) {
                document.getElementById('substanceName').value = entry.substanceName;
            }
        }, 100);
    }

    document.getElementById('amount').value = entry.amount;
    document.getElementById('symptomSeverity').value = entry.symptomSeverity;
    document.getElementById('severityValue').textContent = entry.symptomSeverity;
    document.getElementById('remarks').value = entry.remarks || '';

    // Restore symptoms checkboxes
    Array.from(document.querySelectorAll('#postDoseSymptoms input[type="checkbox"]')).forEach(c => {
        c.checked = (entry.postDoseSymptoms || []).includes(c.value);
    });

    // Restore environmental factors
    Array.from(document.querySelectorAll('#environmentalFactors input[type="checkbox"]')).forEach(c => {
        const envFactors = (entry.environmentalFactors || []);

        if (c.value === 'High Stress' && Array.isArray(envFactors)) {
            const stressFactor = envFactors.find(f => f.startsWith('High Stress:'));
            if (stressFactor) {
                c.checked = true;
                document.getElementById('highStressText').value = stressFactor.substring(12);
                document.getElementById('highStressGroup').style.display = 'block';
            } else {
                c.checked = false;
                document.getElementById('highStressText').value = '';
                document.getElementById('highStressGroup').style.display = 'none';
            }
        } else {
            c.checked = envFactors.includes(c.value);
        }
    });

    document.querySelector('#entryForm button[type="submit"]').textContent = 'Save Entry';
    switchTab('entry');
}

function setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('entryForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        const editId = document.getElementById('editId').value;
        const isEdit = !!editId;
        
        const substanceType = document.getElementById('substanceType').value;
        const substanceNameSelect = document.getElementById('substanceName').value;
        let finalSubstanceName = substanceNameSelect;
        
        // ✅ Check if adding new substance
        if (substanceNameSelect === '__NEW__') {
            const newName = document.getElementById('newSubstanceName').value.trim();
            if (!newName) {
                alert('Please enter a substance name');
                return;
            }
            
            try {
                // Add to Google Sheets using your existing API
                await handleNewSubstance(substanceType, newName);
                finalSubstanceName = newName;
                console.log(`Added new ${substanceType}: ${newName}`);
            } catch (err) {
                console.error('Failed to add new substance:', err);
                alert('Failed to add new substance. Please try again.');
                return;
            }
        }
        
        const data = {
            id: editId || Date.now().toString(),
            entryDate: document.getElementById('entryDate').value,
            entryTime: document.getElementById('entryTime').value,
            substanceType: substanceType,
            substanceName: finalSubstanceName, // ✅ Use the final name
            amount: document.getElementById('amount').value,
            postDoseSymptoms: Array.from(document.querySelectorAll('#postDoseSymptoms input[type="checkbox"]:checked')).map(c => c.value),
            symptomSeverity: document.getElementById('symptomSeverity').value,
            environmentalFactors: getEnvironmentalFactors(),
            remarks: document.getElementById('remarks').value
        };
    
        if (isEdit) {
            await fetch(`/api/entries/id/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        } else {
            await fetch('/api/entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
        }
    
        await loadEntries();
        clearForm();
    });    

    document.getElementById('historyBody').addEventListener('click', function (e) {
        const id = e.target.dataset.id;
// In your setupEventListeners() function, in the historyBody click handler:
// In your setupEventListeners() function, replace the edit-btn handler with this:
// In your setupEventListeners() function, replace the edit-btn handler with:
if (e.target.matches('.edit-btn')) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    document.getElementById('editId').value = entry.id;
    document.getElementById('entryDate').value = entry.entryDate;
    document.getElementById('entryTime').value = entry.entryTime;
    
    // ✅ NEW: Handle substance fields properly
    if (entry.substanceType && entry.substanceName) {
        // Set the substance type first
        document.getElementById('substanceType').value = entry.substanceType;
        
        // Populate the dropdown for this type
        populateSubstanceDropdown(entry.substanceType);
        
        // Set the substance name after dropdown is populated
        setTimeout(() => {
            const substanceNameEl = document.getElementById('substanceName');
            substanceNameEl.value = entry.substanceName;
            
            // Debug: confirm the value was set
            console.log(`Set substance: ${entry.substanceName}, actual: ${substanceNameEl.value}`);
        }, 100);
    }

    document.getElementById('amount').value = entry.amount;
    document.getElementById('symptomSeverity').value = entry.symptomSeverity;
    document.getElementById('severityValue').textContent = entry.symptomSeverity;
    document.getElementById('remarks').value = entry.remarks || '';

    // Restore symptoms checkboxes
    Array.from(document.querySelectorAll('#postDoseSymptoms input[type="checkbox"]')).forEach(c => {
        const symptoms = Array.isArray(entry.postDoseSymptoms) ? entry.postDoseSymptoms : 
                        (entry.postDoseSymptoms ? JSON.parse(entry.postDoseSymptoms) : []);
        c.checked = symptoms.includes(c.value);
    });

    // Restore environmental factors
    Array.from(document.querySelectorAll('#environmentalFactors input[type="checkbox"]')).forEach(c => {
        const envFactors = Array.isArray(entry.environmentalFactors) ? entry.environmentalFactors :
                          (entry.environmentalFactors ? JSON.parse(entry.environmentalFactors) : []);

        if (c.value === 'High Stress') {
            const stressFactor = envFactors.find(f => f.startsWith('High Stress:'));
            if (stressFactor) {
                c.checked = true;
                const highStressText = document.getElementById('highStressText');
                const highStressGroup = document.getElementById('highStressGroup');
                if (highStressText) highStressText.value = stressFactor.substring(12);
                if (highStressGroup) highStressGroup.style.display = 'block';
            } else {
                c.checked = false;
                const highStressText = document.getElementById('highStressText');
                const highStressGroup = document.getElementById('highStressGroup');
                if (highStressText) highStressText.value = '';
                if (highStressGroup) highStressGroup.style.display = 'none';
            }
        } else {
            c.checked = envFactors.includes(c.value);
        }
    });

    document.querySelector('#entryForm button[type="submit"]').textContent = 'Update Entry';
    switchTab('entry');
}

 else if (e.target.matches('.duplicate-btn')) {
            duplicateEntry(id);
        } else if (e.target.matches('.delete')) {
            if (confirm('Are you sure you want to delete this entry?')) {
                fetch(`/api/entries/id/${id}`, { method: 'DELETE' }).then(loadEntries);
            }
        }
    });

    document.getElementById('symptomSeverity').addEventListener('input', e => {
        document.getElementById('severityValue').textContent = e.target.value;
    });

    document.getElementById('searchFilter').addEventListener('input', renderFilteredHistory);
    document.getElementById('categoryFilter').addEventListener('change', renderFilteredHistory);

    document.getElementById('trendSubstanceFilter').addEventListener('change', e => {
        renderDashboardCharts(e.target.value);
    });

    // High Stress checkbox handler with retry mechanism
    function attachHighStressListener() {
        const checkbox = document.getElementById('highStressCheckbox');
        if (checkbox) {
            checkbox.addEventListener('change', function (e) {
                const textGroup = document.getElementById('highStressGroup');
                const textInput = document.getElementById('highStressText');

                if (textGroup) {
                    textGroup.style.display = e.target.checked ? 'block' : 'none';
                }
                if (textInput && !e.target.checked) {
                    textInput.value = '';
                }
            });
        }
    }
    // Call immediately and also after a delay to handle timing issues
    attachHighStressListener();
    setTimeout(attachHighStressListener, 100);

    // Note modal event listeners
    document.getElementById('addNoteBtn').addEventListener('click', () => {
        showNoteModal();
    });

    document.getElementById('cancelNoteBtn').addEventListener('click', hideNoteModal);

    document.getElementById('noteModal').addEventListener('click', (e) => {
        if (e.target.id === 'noteModal') {
            hideNoteModal();
        }
    });

    document.getElementById('noteForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const noteId = document.getElementById('editNoteId').value;
        const isEdit = !!noteId;
        
        const noteData = {
            id: noteId || Date.now().toString(),
            date: document.getElementById('noteDate').value,
            text: document.getElementById('noteText').value
        };
        
        try {
            if (isEdit) {
                await fetch(`/api/notes/id/${noteData.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });
            } else {
                await fetch('/api/notes', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(noteData)
                });
            }
            
            await loadNotes();
            renderFilteredHistory();
            hideNoteModal();
        } catch (err) {
            console.error('Error saving note:', err);
            alert('Error saving reflection. Please try again.');
        }
    });
    // Add these to your setupEventListeners function
// In setupEventListeners(), replace the substance event listeners with:
const substanceTypeEl = document.getElementById('substanceType');
if (substanceTypeEl) {
    substanceTypeEl.addEventListener('change', (e) => {
        populateSubstanceDropdown(e.target.value);
        document.getElementById('newSubstanceGroup').style.display = 'none';
    });
}

const substanceNameEl = document.getElementById('substanceName');
if (substanceNameEl) {
    substanceNameEl.addEventListener('change', (e) => {
        const newSubstanceGroup = document.getElementById('newSubstanceGroup');
        const label = document.getElementById('newSubstanceLabel');
        const type = document.getElementById('substanceType').value;
        
        if (e.target.value === '__NEW__') {
            newSubstanceGroup.style.display = 'block';
            label.textContent = `New ${type.charAt(0).toUpperCase() + type.slice(1)} Name`;
            document.getElementById('newSubstanceName').focus();
        } else {
            newSubstanceGroup.style.display = 'none';
        }
    });
}

const newSubstanceNameEl = document.getElementById('newSubstanceName');
if (newSubstanceNameEl) {
    newSubstanceNameEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const type = document.getElementById('substanceType').value;
            const name = e.target.value.trim();
            
            if (name && type) {
                handleNewSubstance(type, name);
                e.target.value = '';
            }
        }
    });
}

}

function populateSubstanceFilter() {
    const filterSelect = document.getElementById('trendSubstanceFilter');
    filterSelect.innerHTML = '<option value="all">All Substances</option>';
    const substanceSet = new Set(entries.map(e => e.substanceName).filter(Boolean));
    substanceSet.forEach(substance => {
        const option = document.createElement('option');
        option.value = substance;
        option.textContent = substance;
        filterSelect.appendChild(option);
    });
}

// Load all substances
async function loadSubstances() {
    try {
        const [medications, supplements, foods] = await Promise.all([
            fetch('/api/substances/medication').then(r => r.json()),
            fetch('/api/substances/supplement').then(r => r.json()),
            fetch('/api/substances/food').then(r => r.json())
        ]);
        
        medicationsList = medications;
        supplementsList = supplements;
        foodsList = foods;
    } catch (err) {
        console.error('Error loading substances:', err);
    }
}

// Populate substance dropdown based on type
function populateSubstanceDropdown(type, selectedSubstance = null) {
    const nameEl = document.getElementById('substanceName');
    if (!nameEl) return;

    const normalizedType = (type || '').toLowerCase();
    
    let list = [];
    if (normalizedType === 'medication') list = medicationsList;
    else if (normalizedType === 'supplement') list = supplementsList;
    else if (normalizedType === 'food') list = foodsList;

    nameEl.innerHTML = '<option value="">Select...</option>';

    list.forEach(item => {
        const option = document.createElement('option');
        option.value = item.name;
        option.textContent = item.name;
        nameEl.appendChild(option);
    });

    // Handle custom substances
    if (selectedSubstance && !list.find(item => item.name === selectedSubstance)) {
        const customOption = document.createElement('option');
        customOption.value = selectedSubstance;
        customOption.textContent = `${selectedSubstance} (Custom)`;
        nameEl.appendChild(customOption);
    }

    // Add "Add New" option
    const newOption = document.createElement('option');
    newOption.value = '__NEW__';
    newOption.textContent = `Add New ${normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1)}`;
    nameEl.appendChild(newOption);

    // ✅ Enable the dropdown after populating
    nameEl.disabled = false;

    // Set selected value if provided
    if (selectedSubstance) {
        nameEl.value = selectedSubstance;
    }
}

// Handle adding new substances
async function handleNewSubstance(type, name) {
    try {
        const response = await fetch(`/api/substances/${type}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        
        if (response.ok) {
            await loadSubstances(); // Reload substances
            populateSubstanceDropdown(type); // Refresh dropdown
            
            // Select the newly added substance
            document.getElementById('substanceName').value = name;
            document.getElementById('newSubstanceGroup').style.display = 'none';
        }
    } catch (err) {
        console.error('Error adding new substance:', err);
        alert('Error adding new substance. Please try again.');
    }
}
// Add this to your setupEventListeners function or after DOM loads
function setupDependentDropdowns() {
    const substanceTypeEl = document.getElementById('substanceType');
    const substanceNameEl = document.getElementById('substanceName');
    
    if (substanceTypeEl && substanceNameEl) {
        substanceTypeEl.addEventListener('change', function() {
            if (this.value && this.value !== '') {
                // Valid type selected - populate and enable name dropdown
                populateSubstanceDropdown(this.value);
                substanceNameEl.disabled = false;
            } else {
                // No type selected - disable and reset name dropdown  
                substanceNameEl.innerHTML = '<option value="">First select type...</option>';
                substanceNameEl.disabled = true;
            }
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadEntries();
    setupDependentDropdowns();
});
