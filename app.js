const express = require('express');
const path = require('path');
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const CSV_FILE = path.join(__dirname, 'entries.csv');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// CSV Helpers
function readEntries() {
  if (!fs.existsSync(CSV_FILE)) return [];
  const data = fs.readFileSync(CSV_FILE, 'utf8');
  return data.trim() ? parse(data, { columns: true }) : [];
}

function writeEntries(entries) {
  const csv = stringify(entries, { header: true });
  fs.writeFileSync(CSV_FILE, csv);
}

// API Routes
app.get('/api/entries', (req, res) => {
  try {
    res.json(readEntries());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read entries' });
  }
});

app.post('/api/entries', (req, res) => {
  try {
    const entries = readEntries();
    req.body.id = req.body.id || Date.now().toString();
    entries.push(req.body);
    writeEntries(entries);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add entry' });
  }
});

// API: Update entry by ID (safe for filtered/sorted UI)
app.put('/api/entries/id/:id', (req, res) => {
  try {
    const entries = readEntries();
    const entryId = req.params.id;
    const entryIndex = entries.findIndex(e => e.id === entryId);

    if (entryIndex !== -1) {
      // Preserve the original id and merge the new data
      entries[entryIndex] = { ...entries[entryIndex], ...req.body, id: entryId };
      writeEntries(entries);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  } catch (err) {
    console.error('PUT /api/entries/id/:id error:', err);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Delete by id (safe for filtered/sorted UI)
app.delete('/api/entries/id/:id', (req, res) => {
  try {
    const entries = readEntries();
    const idx = entries.findIndex(e => e.id === req.params.id);
    if (idx !== -1) {
      entries.splice(idx, 1);
      writeEntries(entries);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Entry not found' });
    }
  } catch (err) {
    console.error('DELETE /api/entries/id/:id error:', err);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

// SPA Fallback (MUST BE LAST)
app.all('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
