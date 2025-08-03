<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# MCAS Tracker Project Seed Document

## Project Overview

**Project Name:** MCAS Medication \& Food Tracker
**Purpose:** A comprehensive web application for tracking Mast Cell Activation Syndrome (MCAS) symptoms, medications, supplements, and food reactions to help users identify patterns and triggers.

**Target User:** Individuals with MCAS who need to monitor their symptoms, track medication effectiveness, and identify food/environmental triggers to manage their condition effectively.

## Technical Architecture

### Stack \& Technologies

- **Backend:** Node.js with Express.js
- **Frontend:** Vanilla JavaScript (SPA), HTML5, CSS3
- **Data Storage:** CSV files (current), planned migration to Google Sheets API
- **Charts/Visualization:** Chart.js library
- **Deployment:** Render.com (free tier)
- **Package Manager:** npm


### Current File Structure

```
mcas-tracker/
├── app.js                 # Express server and API routes
├── package.json           # Dependencies and scripts
├── package-lock.json      # Locked dependency versions
├── entries.csv            # Data storage (ephemeral on Render)
├── public/
│   ├── index.html         # SPA main page with all tabs
│   ├── script.js          # Client-side JavaScript logic
│   └── style.css          # Styling and responsive design
└── node_modules/          # Dependencies (not committed)
```


## Core Features \& Functionality

### 1. Dashboard Tab

- **Recent Trends Chart:** Line chart showing severity over time with substance filtering
- **Quick Stats:** Total entries, today's entries, average severity, most tracked item
- **Real-time Updates:** Auto-refreshes when new data is added


### 2. Add/Edit Entry Tab

- **Date/Time Input:** Precise timestamp tracking
- **Item Types:** Medications (Famotidine), Supplements (Sunfiber, Topical Aloe Vera), Custom Foods
- **Symptom Tracking:** 15+ checkboxes for post-dose symptoms (Flushing, Hives, Itching, Bloating, Brain Fog, etc.)
- **Severity Scale:** 1-10 slider with visual indicators
- **Environmental Factors:** 9+ checkboxes including custom "High Stress" text field
- **Remarks:** Free-text notes field
- **Form Validation:** Required fields and data integrity checks


### 3. History Tab

- **Data Table:** Sortable table with all entries (most recent first)
- **Search \& Filter:** Text search and category filtering (Medication/Supplement/Food)
- **Inline Actions:** Edit, Duplicate, Delete buttons per entry
- **Expandable Remarks:** Each entry shows remarks in a sub-row
- **CRUD Operations:** Full create, read, update, delete functionality


### 4. Analysis Tab

- **Severity Trend Chart:** Overall severity patterns over time
- **Symptom Frequency Chart:** Bar chart of most common symptoms
- **Data Insights:** Visual analysis of patterns and trends


## Data Model \& Structure

### Entry Schema (CSV columns)

```javascript
{
  id: String,                    // Unique identifier (timestamp-based)
  entryDate: String,            // YYYY-MM-DD format
  entryTime: String,            // HH:MM format
  itemType: String,             // Medication type or "New Food"
  customItem: String,           // Custom food name (when itemType = "New Food")
  amount: String,               // Dosage or quantity
  postDoseSymptoms: String,     // JSON array of selected symptoms
  symptomSeverity: String,      // 1-10 scale
  environmentalFactors: String, // JSON array with custom stress handling
  remarks: String               // Free text notes
}
```


### Key Data Handling

- **Checkbox Arrays:** Stored as JSON strings, parsed for display
- **Custom Text Fields:** "High Stress" checkbox triggers text input for specifics
- **Date/Time:** Separate fields for precise tracking and sorting
- **Defensive Parsing:** Handles missing/malformed data gracefully


## Current Technical State

### Working Features

- ✅ Full CRUD operations for entries
- ✅ Real-time chart updates
- ✅ Responsive design (mobile-friendly)
- ✅ Form state management with validation
- ✅ Search and filtering
- ✅ Data export capability (in development)
- ✅ Duplicate entry functionality (recently implemented)


### Known Issues \& Limitations

- ❌ **Data Persistence Problem:** CSV storage on Render is ephemeral - data lost on restart
- ❌ **No Backup System:** Critical data loss risk
- ❌ **Manual Export Only:** No automated data export
- ❌ **Single User:** No authentication or multi-user support


### Planned Improvements

1. **Google Sheets Integration:** Replace CSV with Google Sheets API for true persistence
2. **Data Export:** Built-in CSV download functionality
3. **Advanced Analytics:** Correlation analysis, trigger identification
4. **Data Backup:** Automated backup strategies
5. **Mobile App:** PWA conversion for better mobile experience

## Code Architecture Details

### Frontend (script.js)

- **State Management:** Global `entries` array with reactive updates
- **Event-Driven:** Comprehensive event listeners for all user interactions
- **Chart Management:** Chart.js integration with instance management
- **Form Handling:** Complex form state with checkbox groups and custom fields
- **Tab Navigation:** SPA routing with proper chart rendering timing


### Backend (app.js)

- **RESTful API:** Clean API endpoints for entry management
- **CSV Operations:** Synchronous read/write operations with error handling
- **ID-based Updates:** Safe updates using unique IDs instead of array indices
- **Express Middleware:** Body parsing, static file serving, SPA fallback


### Styling (style.css)

- **CSS Grid \& Flexbox:** Modern layout techniques
- **Custom Components:** Slider, checkbox grids, responsive tables
- **Color Scheme:** Consistent design system with CSS custom properties
- **Accessibility:** Good contrast ratios and keyboard navigation


## Development Context

### Recent Development

- Added duplicate entry functionality (Aug 2025)
- Implemented custom stress field handling
- Fixed chart rendering timing issues
- Enhanced form state management


### Deployment Status

- **Live URL:** Deployed on Render.com free tier
- **Auto-deploy:** Connected to GitHub for continuous deployment
- **Environment:** Production-ready with proper error handling
- **Performance:** Lightweight, fast loading, responsive


### User Workflow

1. **Daily Tracking:** User logs medications/foods with timestamps
2. **Symptom Monitoring:** Records reactions and severity levels
3. **Pattern Analysis:** Reviews charts and trends to identify triggers
4. **Data Export:** Plans to export data for healthcare providers

## Integration Notes

### Google Sheets Migration (Planned)

- Service account authentication
- Real-time data synchronization
- Maintains existing data structure
- Solves persistence issues


### Healthcare Integration

- Export formats compatible with medical records
- Shareable reports for healthcare providers
- Privacy-focused design

This MCAS Tracker represents a specialized healthcare tool addressing a real medical need with a focus on user experience, data integrity, and actionable insights for chronic condition management.

<div style="text-align: center">⁂</div>

[^1]: combined.txt

