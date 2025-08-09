// --- Global State ---
let entries = [];
let charts = {}; // To hold chart instances
let notes = [];

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

async function loadEntries() {
    const res = await fetch('/api/entries');
    entries = await res.json();
    entries.sort((a, b) => new Date(`${b.entryDate}T${b.entryTime}`) - new Date(`${a.entryDate}T${a.entryTime}`));
    
    // Also load notes
    await loadNotes();
    
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
        const itemText = (e.itemType === 'New Food' ? e.customItem : e.itemType) || '';
        const matchSearch = Object.values(e).some(v => String(v).toLowerCase().includes(search));
        const matchCategory = !category ||
            (category === 'Medication' && itemText.includes('(medication)')) ||
            (category === 'Supplement' && itemText.includes('(supplement)')) ||
            (category === 'Food' && e.itemType === 'New Food');
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
            row.innerHTML = `
                <td data-label="Date/Time">${item.entryDate} ${item.entryTime}</td>
                <td data-label="Item">${escapeHtml(item.itemType === 'New Food' ? item.customItem : item.itemType.replace(/\s*\(.*\)/, ''))}</td>
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
    const totalEntriesElement = document.getElementById('totalEntries');
    if (totalEntriesElement) {
        totalEntriesElement.textContent = entries.length;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const severities = entries.map(e => parseInt(e.symptomSeverity)).filter(n => !isNaN(n));
    document.getElementById('avgSeverity').textContent = severities.length ? (severities.reduce((a, b) => a + b, 0) / severities.length).toFixed(1) : '0.0';
    const counts = {};

    entries.forEach(e => {
        const item = e.itemType === 'New Food' ? e.customItem : e.itemType.replace(/\s*\(.*\)/, '');
        if (item) counts[item] = (counts[item] || 0) + 1;
    });

    const topItem = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    document.getElementById('mostTracked').textContent = topItem ? `${topItem[0]} (${topItem[1]})` : 'None';

    const todayEntriesElement = document.getElementById('todayEntries');
    if (todayEntriesElement) {
        todayEntriesElement.textContent = entries.filter(e => e.entryDate === todayStr).length;
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
        dataSet = dataSet.filter(e => { const item = e.itemType === 'New Food' ? e.customItem : e.itemType.replace(/\s*\(.*\)/, ''); return item === substance; });
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
    document.getElementById('customItemGroup').style.display = 'none';
    document.getElementById('severityValue').textContent = '1';
    document.getElementById('editId').value = '';
    document.querySelector('#entryForm button[type="submit"]').textContent = 'Save Entry';

    // Clear all custom text fields and their visibility
    const highStressGroup = document.getElementById('highStressGroup');
    const highStressText = document.getElementById('highStressText');
    if (highStressGroup) highStressGroup.style.display = 'none';
    if (highStressText) highStressText.value = '';

    // Reset custom text fields
    resetCustomTextFields();
}

function duplicateEntry(id) {

    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    // Clear the form first
    clearForm();

    // Set current date and time
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const currentTime = now.toTimeString().slice(0, 5);   // HH:MM format

    // NO editId - this creates a new entry
    document.getElementById('editId').value = '';

    // Set current timestamp
    document.getElementById('entryDate').value = currentDate;
    document.getElementById('entryTime').value = currentTime;

    // Copy all other data from original entry
    document.getElementById('itemType').value = entry.itemType;
    document.getElementById('customItem').value = entry.customItem || '';
    document.getElementById('amount').value = entry.amount;
    document.getElementById('symptomSeverity').value = entry.symptomSeverity;
    document.getElementById('severityValue').textContent = entry.symptomSeverity;
    document.getElementById('remarks').value = entry.remarks || '';

    // Restore symptoms checkboxes
    Array.from(document.querySelectorAll('#postDoseSymptoms input[type="checkbox"]')).forEach(c => {
        c.checked = (entry.postDoseSymptoms || []).includes(c.value);
    });

    // Restore environmental factors with proper text field handling and fix typo
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

    // Show custom item group if needed
    document.getElementById('customItemGroup').style.display = (entry.itemType === 'New Food') ? 'block' : 'none';

    // Set button text to indicate this is a new entry
    document.querySelector('#entryForm button[type="submit"]').textContent = 'Save Entry';

    // Switch to entry tab for editing
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
        const data = {
            id: editId || Date.now().toString(),
            entryDate: document.getElementById('entryDate').value,
            entryTime: document.getElementById('entryTime').value,
            itemType: document.getElementById('itemType').value,
            customItem: document.getElementById('customItem').value,
            amount: document.getElementById('amount').value,
            postDoseSymptoms: Array.from(document.querySelectorAll('#postDoseSymptoms input[type="checkbox"]:checked')).map(c => c.value),
            symptomSeverity: document.getElementById('symptomSeverity').value,
            environmentalFactors: getEnvironmentalFactors(), // This returns an array
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
        if (e.target.matches('.edit-btn')) {
            const entry = entries.find(e => e.id === id);
            if (!entry) return;

            document.getElementById('editId').value = entry.id;
            document.getElementById('entryDate').value = entry.entryDate;
            document.getElementById('entryTime').value = entry.entryTime;
            document.getElementById('itemType').value = entry.itemType;
            document.getElementById('customItem').value = entry.customItem || '';
            document.getElementById('amount').value = entry.amount;
            document.getElementById('symptomSeverity').value = entry.symptomSeverity;
            document.getElementById('severityValue').textContent = entry.symptomSeverity;
            document.getElementById('remarks').value = entry.remarks || '';

            // Restore symptoms checkboxes
            Array.from(document.querySelectorAll('#postDoseSymptoms input[type="checkbox"]')).forEach(c => {
                // postDoseSymptoms should already be an array from the backend
                const symptoms = Array.isArray(entry.postDoseSymptoms) ? entry.postDoseSymptoms : [];
                c.checked = symptoms.includes(c.value);
            });

            // Enhanced environmental factors restoration with proper text field handling
            Array.from(document.querySelectorAll('#environmentalFactors input[type="checkbox"]')).forEach(c => {
                const envFactors = Array.isArray(entry.environmentalFactors) ? entry.environmentalFactors : [];

                if (c.value === 'High Stress') {
                    // Check if any factor starts with "High Stress:"
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
                    // ✅ FIX: Handle all other environmental factors
                    c.checked = envFactors.includes(c.value);
                }
            });

            document.getElementById('customItemGroup').style.display = (entry.itemType === 'New Food') ? 'block' : 'none';
            document.querySelector('#entryForm button[type="submit"]').textContent = 'Update Entry';

            // Reset any other custom text fields after loading
            resetCustomTextFields();

            // Ensure the High Stress text group is visible if the checkbox is checked
            const highStressCheckbox = document.getElementById('highStressCheckbox');
            if (highStressCheckbox && highStressCheckbox.checked) {
                document.getElementById('highStressGroup').style.display = 'block';
            }
            switchTab('entry');
        } else if (e.target.matches('.duplicate-btn')) {
            duplicateEntry(id);
        } else if (e.target.matches('.delete')) {
            if (confirm('Are you sure you want to delete this entry?')) {
                fetch(`/api/entries/id/${id}`, { method: 'DELETE' }).then(loadEntries);
            }
        }
    });

    document.getElementById('itemType').addEventListener('change', e => {
        document.getElementById('customItemGroup').style.display = (e.target.value === 'New Food') ? 'block' : 'none';
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
}

function populateSubstanceFilter() {
    const filterSelect = document.getElementById('trendSubstanceFilter');
    filterSelect.innerHTML = '<option value="all">All Substances</option>';
    const substanceSet = new Set(entries.map(e => e.itemType === 'New Food' ? e.customItem : e.itemType.replace(/\s*\(.*\)/, '')).filter(Boolean));
    substanceSet.forEach(substance => {
        const option = document.createElement('option');
        option.value = substance;
        option.textContent = substance;
        filterSelect.appendChild(option);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadEntries();
});
