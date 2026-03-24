/**
 * ============================================================
 *  CLIENT ONBOARDING & STRATEGY FORM — Google Apps Script REST API
 * ============================================================
 *
 *  SETUP INSTRUCTIONS
 *  ------------------
 *  1. Open your Google Sheet → Extensions → Apps Script
 *  2. Paste this entire file into the editor (replace any existing code)
 *  3. Save (Ctrl+S), then click ▶ Run → "setup" to initialize
 *  4. Deploy → New Deployment → Web App
 *       - Execute as: Me
 *       - Who has access: Anyone  (or "Anyone with link" for semi-private)
 *  5. Copy the Web App URL — that is your base API URL
 *
 *  ENDPOINTS
 *  ---------
 *  GET  ?action=getAll                         → all client records
 *  GET  ?action=getById&id=<rowIndex>          → single record by row index
 *  GET  ?action=search&field=<key>&value=<v>   → search by any field key
 *  POST { action:"create", data:{...} }        → append a new row
 *  POST { action:"update", id:<row>, data:{..} } → update existing row
 *  POST { action:"delete", id:<row> }          → delete a row
 *
 *  All responses are JSON with { success, data?, error?, meta? }
 * ============================================================
 */

// ── CONFIG ───────────────────────────────────────────────────
const SHEET_NAME = "onboard"; // Change if your tab name differs
const API_KEY    = "jhbjgfhftrd43534432dfxf";                 // Optional: set a secret key to restrict access
const AUTOMONK_WEBHOOK_URL = "https://noncalcified-tisa-unreproachable.ngrok-free.dev/api/webhooks/google-sheet-client";
const AUTOMONK_WEBHOOK_SECRET = "jhbjgfhftrd43534432dfxf";
//   If set, every request must include ?apiKey=<API_KEY>  (GET)
//   or  { "apiKey": "<API_KEY>" }  in the POST body

// ── COLUMN DEFINITIONS ───────────────────────────────────────
// Maps a short camelCase key to the exact column header in the sheet.
// Add / remove entries here if your columns ever change.
const COLUMNS = {
  timestamp        : "Timestamp",
  fullName         : "1. Full Name & Preferred Username",
  whatsapp         : "2. WhatsApp Number (For our dedicated client group)",
  email            : "3. Best Email Address (For invoicing and official comms)",
  digitalAssets    : "4. Current Digital Assets",
  instagramHandle  : "5. Instagram Handle",
  nicheMarket      : "6. Niche & Market",
  problem          : "7. The Problem",
  accountGoal      : "8. Account Goal",
  cta              : "9. Call-To-Action (CTA)",
  automationKeyword: "10. Automation Keyword & Flow",
  leadMagnets      : "11. Lead Magnets",
  brandVibe        : "12. Brand Vibe & Tone of Voice",
  language         : "13. Language Preference",
  brandAssets      : "14. Brand Assets (Logos, Colors, Fonts)",
  bioTemplate      : "15. Bio Template",
  notToDoList      : "16. The \"Not To-Do\" List",
  imageAssets      : "17. Image Assets",
  videoAssets      : "18. Video Assets",
  templateSelection: "19. Template Selection",
  competitorAnalysis: "20. Competitor Analysis",
  topicMasterclass : "21. Topic Masterclass",
  founderBackstory : "22. Founder Backstory"
};

// ── HELPERS ──────────────────────────────────────────────────

/**
 * Returns the active sheet or throws a descriptive error.
 */
function getSheet_() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found. Check SHEET_NAME in the script.`);
  return sheet;
}

/**
 * Reads the header row and returns an array of header strings.
 */
function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
}

/**
 * Converts a raw data row (array) + headers into a structured object.
 * Adds a synthetic `_rowIndex` so callers can reference the row later.
 */
function rowToObject_(row, headers, rowIndex) {
  const obj = { _rowIndex: rowIndex };
  // Build a reverse map: header string → camelCase key
  const reverseMap = {};
  Object.entries(COLUMNS).forEach(([key, header]) => { reverseMap[header] = key; });

  headers.forEach((header, i) => {
    const key = reverseMap[header] || header; // fall back to raw header if unmapped
    obj[key] = row[i] !== undefined ? row[i] : "";
  });
  return obj;
}

/**
 * Converts a data object back into an array ordered by sheet headers.
 */
function objectToRow_(obj, headers) {
  const reverseMap = {};
  Object.entries(COLUMNS).forEach(([key, header]) => { reverseMap[key] = header; });

  return headers.map(header => {
    // Find the camelCase key for this header
    const camelKey = Object.keys(COLUMNS).find(k => COLUMNS[k] === header);
    if (camelKey && obj[camelKey] !== undefined) return obj[camelKey];
    if (obj[header]  !== undefined)              return obj[header];
    return "";
  });
}

/**
 * Verifies the API key when one is configured.
 */
function checkAuth_(params) {
  if (!API_KEY) return; // no key configured — open access
  const provided = (params && params.apiKey) ? params.apiKey : "";
  if (provided !== API_KEY) throw new Error("Unauthorized: invalid or missing apiKey.");
}

/**
 * Wraps any value in a CORS-friendly JSON response.
 */
function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function firstValue_(values) {
  if (!values || !values.length) return "";
  return String(values[0]).trim();
}

function buildWebhookPayloadFromNamedValues_(namedValues) {
  const get = header => firstValue_(namedValues[header]);
  const submittedAt = get(COLUMNS.timestamp);
  const email = get(COLUMNS.email);
  const whatsapp = get(COLUMNS.whatsapp);
  const instagramHandle = get(COLUMNS.instagramHandle);

  return {
    source: "google_sheets_form",
    submittedAt: submittedAt,
    dedupeKey: [email, whatsapp, instagramHandle, submittedAt].join("|"),
    client: {
      fullNamePreferredUsername: get(COLUMNS.fullName),
      whatsappNumber: whatsapp,
      email: email,
      currentDigitalAssets: get(COLUMNS.digitalAssets),
      instagramHandle: instagramHandle,
      nicheMarket: get(COLUMNS.nicheMarket),
      problem: get(COLUMNS.problem),
      accountGoal: get(COLUMNS.accountGoal),
      cta: get(COLUMNS.cta),
      automationKeywordFlow: get(COLUMNS.automationKeyword),
      leadMagnets: get(COLUMNS.leadMagnets),
      brandVibeTone: get(COLUMNS.brandVibe),
      languagePreference: get(COLUMNS.language),
      brandAssets: get(COLUMNS.brandAssets),
      bioTemplate: get(COLUMNS.bioTemplate),
      notToDoList: get(COLUMNS.notToDoList),
      imageAssets: get(COLUMNS.imageAssets),
      videoAssets: get(COLUMNS.videoAssets),
      templateSelection: get(COLUMNS.templateSelection),
      competitorAnalysis: get(COLUMNS.competitorAnalysis),
      topicMasterclass: get(COLUMNS.topicMasterclass),
      founderBackstory: get(COLUMNS.founderBackstory)
    }
  };
}

function sendToAutomonkWebhook_(payload) {
  if (!AUTOMONK_WEBHOOK_URL || AUTOMONK_WEBHOOK_URL.indexOf("your-domain.com") !== -1) {
    throw new Error("Set AUTOMONK_WEBHOOK_URL before using onFormSubmit.");
  }

  if (!AUTOMONK_WEBHOOK_SECRET || AUTOMONK_WEBHOOK_SECRET.indexOf("replace-with") !== -1) {
    throw new Error("Set AUTOMONK_WEBHOOK_SECRET before using onFormSubmit.");
  }

  const response = UrlFetchApp.fetch(AUTOMONK_WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    headers: {
      "X-Automonk-Webhook-Secret": AUTOMONK_WEBHOOK_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(`AutoMonk webhook failed with status ${status}: ${response.getContentText()}`);
  }

  return status;
}

// ── CRUD OPERATIONS ──────────────────────────────────────────

/** Returns all rows as an array of objects (skips header row). */
function getAllRecords_() {
  const sheet   = getSheet_();
  const headers = getHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const data = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return data.map((row, i) => rowToObject_(row, headers, i + 2)); // +2: 1-indexed + header
}

/** Returns a single record by 1-indexed row number (≥ 2). */
function getRecordById_(rowIndex) {
  const idx = parseInt(rowIndex, 10);
  if (isNaN(idx) || idx < 2) throw new Error("id must be a number ≥ 2 (row 1 is the header).");

  const sheet   = getSheet_();
  const headers = getHeaders_(sheet);
  if (idx > sheet.getLastRow()) throw new Error(`Row ${idx} does not exist.`);

  const row = sheet.getRange(idx, 1, 1, headers.length).getValues()[0];
  return rowToObject_(row, headers, idx);
}

/** Searches for records where a given field (camelCase key) matches a value. */
function searchRecords_(fieldKey, value) {
  if (!fieldKey) throw new Error("field is required for search.");
  const all = getAllRecords_();
  const v   = (value || "").toString().toLowerCase();
  return all.filter(record => {
    const cell = (record[fieldKey] || "").toString().toLowerCase();
    return cell.includes(v);
  });
}

/** Appends a new row. Timestamp is auto-filled if omitted. */
function createRecord_(data) {
  if (!data) throw new Error("data object is required.");
  const sheet   = getSheet_();
  const headers = getHeaders_(sheet);

  if (!data.timestamp) data.timestamp = new Date().toLocaleString();
  const row = objectToRow_(data, headers);
  sheet.appendRow(row);

  return { message: "Record created.", _rowIndex: sheet.getLastRow() };
}

/** Updates specific fields of an existing row (partial update supported). */
function updateRecord_(rowIndex, data) {
  const idx = parseInt(rowIndex, 10);
  if (isNaN(idx) || idx < 2) throw new Error("id must be a number ≥ 2.");
  if (!data) throw new Error("data object is required.");

  const sheet   = getSheet_();
  const headers = getHeaders_(sheet);
  if (idx > sheet.getLastRow()) throw new Error(`Row ${idx} does not exist.`);

  // Read existing, merge, write back
  const existing = getRecordById_(idx);
  const merged   = Object.assign({}, existing, data);
  const row      = objectToRow_(merged, headers);

  sheet.getRange(idx, 1, 1, headers.length).setValues([row]);
  return { message: "Record updated.", _rowIndex: idx };
}

/** Deletes a row by 1-indexed row number. */
function deleteRecord_(rowIndex) {
  const idx = parseInt(rowIndex, 10);
  if (isNaN(idx) || idx < 2) throw new Error("id must be a number ≥ 2.");

  const sheet = getSheet_();
  if (idx > sheet.getLastRow()) throw new Error(`Row ${idx} does not exist.`);

  sheet.deleteRow(idx);
  return { message: `Row ${idx} deleted.` };
}

// ── HTTP ENTRY POINTS ─────────────────────────────────────────

/**
 * Handles GET requests.
 * Query params: action, id, field, value, apiKey
 */
function doGet(e) {
  try {
    const params = e.parameter || {};
    checkAuth_(params);

    const action = (params.action || "getAll").toLowerCase();
    let result;

    switch (action) {
      case "getall":
        result = getAllRecords_();
        return jsonResponse_({ success: true, data: result, meta: { count: result.length } });

      case "getbyid":
        result = getRecordById_(params.id);
        return jsonResponse_({ success: true, data: result });

      case "search":
        result = searchRecords_(params.field, params.value);
        return jsonResponse_({ success: true, data: result, meta: { count: result.length } });

      case "schema":
        return jsonResponse_({ success: true, data: COLUMNS });

      default:
        return jsonResponse_({ success: false, error: `Unknown action "${params.action}". Valid: getAll, getById, search, schema.` });
    }
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  }
}

/**
 * Handles POST requests.
 * Body (JSON): { action, id?, data?, apiKey? }
 */
function doPost(e) {
  try {
    let body = {};
    if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    checkAuth_(body);

    const action = (body.action || "").toLowerCase();
    let result;

    switch (action) {
      case "create":
        result = createRecord_(body.data);
        return jsonResponse_({ success: true, ...result });

      case "update":
        result = updateRecord_(body.id, body.data);
        return jsonResponse_({ success: true, ...result });

      case "delete":
        result = deleteRecord_(body.id);
        return jsonResponse_({ success: true, ...result });

      default:
        return jsonResponse_({ success: false, error: `Unknown action "${body.action}". Valid: create, update, delete.` });
    }
  } catch (err) {
    return jsonResponse_({ success: false, error: err.message });
  }
}

/**
 * Installable trigger entrypoint.
 * Add a trigger in Apps Script:
 *   From spreadsheet -> On form submit
 */
function onFormSubmit(e) {
  if (!e || !e.namedValues) {
    throw new Error("onFormSubmit requires a form submit event.");
  }

  const payload = buildWebhookPayloadFromNamedValues_(e.namedValues);
  const status = sendToAutomonkWebhook_(payload);
  Logger.log(`AutoMonk webhook delivered with status ${status}`);
}

// ── ONE-TIME SETUP ───────────────────────────────────────────

/**
 * Run this once from the Apps Script editor to verify the sheet is readable.
 * Menu: Run → setup
 */
function setup() {
  const sheet   = getSheet_();
  const headers = getHeaders_(sheet);
  const rows    = sheet.getLastRow() - 1; // minus header
  Logger.log(`✅ Connected to sheet: "${SHEET_NAME}"`);
  Logger.log(`   Columns (${headers.length}): ${headers.join(" | ")}`);
  Logger.log(`   Data rows: ${rows}`);
  Logger.log("Setup complete. Deploy as Web App to activate the REST API.");
  Logger.log("Then add an installable trigger for onFormSubmit to push new submissions to AutoMonk.");
}
