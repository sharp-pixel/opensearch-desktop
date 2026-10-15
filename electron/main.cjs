// Copyright OpenSearch Contributors
// SPDX-License-Identifier: Apache-2.0
//
// The OpenSearch Contributors require contributions made to
// this file be licensed under the Apache-2.0 license or a
// compatible open source license.

const { app, BrowserWindow, shell, ipcMain, safeStorage, net, dialog, Menu, session } = require('electron');
const path = require('path');
const { cancelRequest } = require('../shared/node/requests.cjs');
const { createHttpProxy } = require('./http.cjs');
const { createWindowCloseGuard } = require('./windowClose.cjs');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { isTrustedSender, configureNavigation, configureLocalCertificates } = require('./security.cjs');


/**
 * Validate AWS profile name to prevent injection attacks
 * Only allows alphanumeric characters, hyphens, underscores, and periods
 */
function isValidProfileName(profileName) {
  if (typeof profileName !== 'string') {
    return false;
  }
  // AWS profile names: alphanumeric, hyphens, underscores, periods, max 64 chars
  const validPattern = /^[a-zA-Z0-9_.-]{1,64}$/;
  return validPattern.test(profileName);
}

let mainWindow;
let closeGuard;
let applicationMenu;
let quitting = false;

// Determine if we're in development or production
const isDev = !app.isPackaged;
const entryUrl = isDev
  ? 'http://localhost:5173/'
  : pathToFileURL(path.join(__dirname, '../dist/index.html')).href;

/**
 * Parse AWS credentials/config file format (INI-like)
 */
function parseAwsConfigFile(content) {
  const profiles = {};
  let currentProfile = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
      continue;
    }

    // Check for profile header [profile name] or [name]
    const profileMatch = trimmed.match(/^\[(?:profile\s+)?([^\]]+)\]$/);
    if (profileMatch) {
      currentProfile = profileMatch[1].trim();
      profiles[currentProfile] = profiles[currentProfile] || {};
      continue;
    }

    // Parse key = value
    if (currentProfile) {
      const keyValueMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (keyValueMatch) {
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();
        profiles[currentProfile][key] = value;
      }
    }
  }

  return profiles;
}

/**
 * Read AWS credentials from ~/.aws/credentials
 */
function readAwsCredentials() {
  try {
    const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');
    if (!fs.existsSync(credentialsPath)) {
      return {};
    }
    const content = fs.readFileSync(credentialsPath, 'utf-8');
    return parseAwsConfigFile(content);
  } catch (error) {
    console.error('Failed to read AWS credentials:', error);
    return {};
  }
}

/**
 * Read AWS config from ~/.aws/config
 */
function readAwsConfig() {
  try {
    const configPath = path.join(os.homedir(), '.aws', 'config');
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const content = fs.readFileSync(configPath, 'utf-8');
    return parseAwsConfigFile(content);
  } catch (error) {
    console.error('Failed to read AWS config:', error);
    return {};
  }
}

/**
 * Get list of available AWS profiles
 */
function getAwsProfiles() {
  const credentials = readAwsCredentials();
  const config = readAwsConfig();
  
  // Merge profile names from both files
  const profileNames = new Set([
    ...Object.keys(credentials),
    ...Object.keys(config),
  ]);

  const profiles = [];
  for (const name of profileNames) {
    const creds = credentials[name] || {};
    const conf = config[name] || {};
    
    profiles.push({
      name,
      hasCredentials: !!(creds.aws_access_key_id && creds.aws_secret_access_key),
      region: conf.region || creds.region || null,
      // Don't expose actual credentials in the list
    });
  }

  return profiles.sort((a, b) => {
    // Put 'default' first
    if (a.name === 'default') return -1;
    if (b.name === 'default') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get credentials for a specific AWS profile
 */
function getAwsProfileCredentials(profileName) {
  // Validate profile name to prevent injection attacks
  if (!isValidProfileName(profileName)) {
    console.error('Invalid AWS profile name:', profileName);
    return null;
  }

  const credentials = readAwsCredentials();
  const config = readAwsConfig();
  
  const creds = credentials[profileName] || {};
  const conf = config[profileName] || {};

  if (!creds.aws_access_key_id || !creds.aws_secret_access_key) {
    return null;
  }

  return {
    accessKeyId: creds.aws_access_key_id,
    secretAccessKey: creds.aws_secret_access_key,
    sessionToken: creds.aws_session_token || null,
    region: conf.region || creds.region || null,
  };
}

function createWindow() {
  applicationMenu.update({});
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    show: false,
  });

  // Show window when ready to prevent visual flash
  closeGuard = createWindowCloseGuard(mainWindow);
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  configureNavigation(mainWindow.webContents, shell, entryUrl);

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    applicationMenu.update({});
    mainWindow = null;
  });
}

// Set up IPC handlers for AWS credentials
function setupIpcHandlers() {
  const documents = require('./documents.cjs').createDocumentFiles({ dialog, getWindow: () => mainWindow,
    registryPath: path.join(app.getPath('userData'), 'document-access.json') });
  const handle = (channel, handler) => {
    ipcMain.handle(channel, (event, ...args) => {
      if (!isTrustedSender(event, mainWindow?.webContents, entryUrl)) {
        throw new Error('Untrusted IPC sender');
      }
      return handler(event, ...args);
    });
  };
  handle('menu:update', (_event, state) => applicationMenu.update(state));
  handle('documents:open', (_event, options) => documents.open(options));
  handle('documents:read', (_event, filename) => documents.read(filename));
  handle('documents:save', (_event, request) => documents.save(request));
  handle('grpc:execute', (_event, request) => require('../shared/node/grpc.cjs').executeGrpc(request));
  handle('window:watch-close', (_event, id, enabled) => closeGuard?.watch(id, enabled));
  handle('window:complete-close', (_event, id, allowed) => {
    if (allowed !== true) quitting = false;
    closeGuard?.complete(id, allowed);
  });
  // Get list of AWS profiles
  handle('aws:getProfiles', () => {
    return getAwsProfiles();
  });

  // Get credentials for a specific profile (with validation)
  handle('aws:getProfileCredentials', (event, profileName) => {
    // Validation is done inside getAwsProfileCredentials
    return getAwsProfileCredentials(profileName);
  });

  // Refresh profiles (re-read from disk)
  handle('aws:refreshProfiles', () => {
    return getAwsProfiles();
  });

  // Secure storage handlers using Electron's safeStorage
  handle('safeStorage:isAvailable', () => {
    return safeStorage.isEncryptionAvailable();
  });

  handle('safeStorage:encrypt', (event, plaintext) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    if (typeof plaintext !== 'string') {
      return null;
    }
    try {
      const encrypted = safeStorage.encryptString(plaintext);
      // Return as base64 string for easy storage
      return encrypted.toString('base64');
    } catch (error) {
      console.error('safeStorage encryption failed:', error);
      return null;
    }
  });

  handle('safeStorage:decrypt', (event, encryptedBase64) => {
    if (!safeStorage.isEncryptionAvailable()) {
      return null;
    }
    if (typeof encryptedBase64 !== 'string') {
      return null;
    }
    try {
      const encrypted = Buffer.from(encryptedBase64, 'base64');
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      console.error('safeStorage decryption failed:', error);
      return null;
    }
  });

  handle('requests:cancel', (_event, requestId) => cancelRequest(requestId));
  const proxy = createHttpProxy(net.fetch.bind(net));
  handle('fetch:proxy', (_event, url, options) => proxy(url, options));
}

app.whenReady().then(() => {
  configureLocalCertificates(session.defaultSession);
  applicationMenu = require('./menu.cjs').createApplicationMenu({ Menu, app, getWindow: () => mainWindow });
  setupIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' || quitting) {
    app.quit();
  }
});
