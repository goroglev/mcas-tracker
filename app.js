require('dotenv').config({ path: '.env.local' });

const express = require('express');
const path = require('path');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const app = express();

const credentialsBase64 = process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64;
let credentials;

if (credentialsBase64) {
    credentials = JSON.parse(Buffer.from(credentialsBase64, 'base64').toString());
}

const client = new google.auth.JWT(
    {
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    }
);

client.authorize(function (err, tokens) {
    if (err) {
        console.error('Failed to authorize Google Sheets API:', err);
    }
});

const sheets = google.sheets({ version: 'v4', auth: client });
const bodyParser = require('body-parser'); // Added body-parser require

app.use(bodyParser.json()); // Add body-parser middleware for JSON

// Add logging middleware for API requests
// app.use('/api', (req, res, next) => {
//     console.log(`API request received: ${req.method} ${req.originalUrl}`);
//     next(); // Pass the request to the next handler
// });

// Add route handler for the root path to serve index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
async function writeEntries(entries) {
    const headers = ['id', 'entryDate', 'entryTime', 'itemType', 'customItem', 'amount', 'postDoseSymptoms', 'symptomSeverity', 'environmentalFactors', 'remarks'];
    const values = entries.map(entry => [
        entry.id,
        entry.entryDate,
        entry.entryTime,
        entry.itemType,
        entry.customItem,
        entry.amount,
        JSON.stringify(entry.postDoseSymptoms),
        entry.symptomSeverity,
        JSON.stringify(entry.environmentalFactors),
        entry.remarks
    ]);

    const dataToWrite = [headers, ...values];

    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        });
        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
            valueInputOption: 'RAW',
            resource: {
                values: dataToWrite,
            },
        });;
    } catch (err) {
        throw new Error('Failed to write entries to Google Sheets');
    }
}

async function readEntries() {
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        });


        const rows = response.data.values;

        if (!rows || rows.length === 0) {
            return []; // No data in the sheet
        }

        // Assuming the first row is headers, process the rest
        const headers = rows[0];
        const entries = rows.slice(1).map(row => {
const entry = {};
            headers.forEach((header, index) => {
                entry[header] = row[index] || ''; // Map columns to object properties
});
            return entry;
        });

        // Parse JSON string fields
        entries.forEach(entry => {
            if (entry.postDoseSymptoms && typeof entry.postDoseSymptoms === 'string') {
                try {
                    entry.postDoseSymptoms = JSON.parse(entry.postDoseSymptoms);
                } catch (e) {
                    console.error('Failed to parse postDoseSymptoms JSON:', e);
                    entry.postDoseSymptoms = [];
                }
            } else {
                entry.postDoseSymptoms = []; // Ensure it's an array even if empty or not a string
            }

            if (entry.environmentalFactors && typeof entry.environmentalFactors === 'string') {
                try {
                    entry.environmentalFactors = JSON.parse(entry.environmentalFactors);
                } catch (e) {
                    console.error('Failed to parse environmentalFactors JSON:', e);
                    entry.environmentalFactors = [];
                }
            } else {
                entry.environmentalFactors = []; // Ensure it's an array
            }
        });

        return entries;
    } catch (err) {
        console.error('The API returned an error reading from Google Sheets:', err);
throw new Error('Failed to read entries from Google Sheets');
}
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID; // Use environment variable for Sheet ID
const RANGE = process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A1:J'; // Use environment variable for range

app.get('/api/entries', async (req, res) => {
    try {
        const entries = await readEntries();
        res.json(entries);
    } catch (err) {
        console.error('Error in GET /api/entries:', err);
        res.status(500).json({ error: 'Failed to retrieve entries from Google Sheets' });
    }
});

app.post('/api/entries', async (req, res) => {
    const newEntry = req.body;
    // Ensure new entry has an ID if not provided (important for unique identification in Google Sheets)
    if (!newEntry.id) {
        newEntry.id = Date.now().toString();
    }
    try {
        const entries = await readEntries(); // Read existing
        entries.push(newEntry); // Add new
        await writeEntries(entries); // Write back all
        res.status(201).json(newEntry);
    } catch (err) {
        console.error('Error in POST /api/entries:', err);
        res.status(500).json({ error: 'Failed to add entry to Google Sheets' });
    }
});

// PUT route to update an entry
app.put('/api/entries/id/:id', async (req, res) => {
    const entryId = req.params.id;
    const updatedEntry = req.body;
    try {
        let entries = await readEntries(); // Read existing
        const index = entries.findIndex(entry => entry.id === entryId);
        if (index !== -1) {
            // Update the entry, preserving the original ID
            entries[index] = { ...updatedEntry, id: entryId };
            await writeEntries(entries); // Write back all
            res.json(entries[index]);
        } else {
            res.status(404).json({ error: 'Entry not found' });
        }
    } catch (err) {
        console.error('Error in PUT /api/entries/id/:id:', err);
        res.status(500).json({ error: 'Failed to update entry in Google Sheets' });
    }
});

// DELETE route to remove an entry
app.delete('/api/entries/id/:id', async (req, res) => {
    const entryId = req.params.id;
    try {
        let entries = await readEntries(); // Read existing
        const initialLength = entries.length;
        entries = entries.filter(entry => entry.id !== entryId); // Filter out the entry
        if (entries.length < initialLength) {
            await writeEntries(entries); // Write back the filtered list
            res.status(200).json({ message: 'Entry deleted successfully' });
        } else {
            res.status(404).json({ error: 'Entry not found' });
        }
    } catch (err) {
        console.error('Error in DELETE /api/entries/id/:id:', err);
        res.status(500).json({ error: 'Failed to delete entry from Google Sheets' });
    }
});
app.use(express.static(path.join(__dirname, 'public')));


const port = process.env.PORT || 3000;
app.listen(port, () => {
console.log(`Server running at http://localhost:${port}`);
});