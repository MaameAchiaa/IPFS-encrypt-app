// Symmetric Encryption (AES) Logic

function symEncrypt(plaintext, key) {
    return CryptoJS.AES.encrypt(plaintext, key).toString();
}

function symDecrypt(ciphertext, key) {
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, key);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (!decrypted) {
            throw new Error('Decryption failed. Invalid key or corrupted data.');
        }
        return decrypted;
    } catch (error) {
        throw new Error('Decryption failed: ' + error.message);
    }
}

// DOM Elements
const symText = document.getElementById('symText');
const symFileInput = document.getElementById('symFileInput');
const symKey = document.getElementById('symKey');
const symEncryptBtn = document.getElementById('symEncryptBtn');
const symDecryptBtn = document.getElementById('symDecryptBtn');
const symCidInput = document.getElementById('symCidInput');
const symDecryptCidBtn = document.getElementById('symDecryptCidBtn');
const symStatus = document.getElementById('symStatus');
const symCidDisplay = document.getElementById('symCidDisplay');
const symExportDataBtn = document.getElementById('symExportDataBtn');
const symImportDataBtn = document.getElementById('symImportDataBtn');
const symCopyIdBtn = document.getElementById('symCopyIdBtn');

function setSymStatus(message, isError = false) {
    if (symStatus) {
        symStatus.textContent = message;
        symStatus.className = 'status-box' + (isError ? ' error' : '');
    }
    console.log((isError ? '❌' : '✅'), message);
}

// Encrypt and Store
symEncryptBtn.addEventListener('click', async () => {
    try {
        setSymStatus('⏳ Processing...');
        symEncryptBtn.disabled = true;
        symEncryptBtn.textContent = '⏳ Encrypting...';
        
        const key = symKey.value.trim();
        if (!key) {
            throw new Error('Please enter a secret key.');
        }
        
        if (key.length < 8) {
            throw new Error('Secret key should be at least 8 characters.');
        }
        
        const data = await getInputData(symText, symFileInput);
        const payload = data.type === 'file'
            ? `file:${data.filename}|${data.content}`
            : `text:${data.content}`;
        
        console.log('📝 Payload size:', payload.length, 'bytes');
        
        const encrypted = symEncrypt(payload, key);
        console.log('🔒 Encrypted length:', encrypted.length);
        
        // Store on IPFS or localStorage
        const cid = await storeToIpfs(encrypted);
        
        // Check if it's a real IPFS CID or local ID
        const isIPFS = !cid.startsWith('local-');
        console.log('📦 Storage ID:', cid, isIPFS ? '(IPFS)' : '(Local)');
        
        symCidDisplay.textContent = `✅ ${isIPFS ? 'CID' : 'ID'}: ${cid}`;
        symCidInput.value = cid;
        
        if (isIPFS) {
            setSymStatus(`✅ Successfully stored on IPFS! CID: ${cid}`);
        } else {
            setSymStatus(`✅ Successfully stored locally! ID: ${cid} (Export to share)`);
        }
        
        // Clear inputs
        symText.value = '';
        symFileInput.value = '';
        
    } catch (error) {
        setSymStatus(`❌ ${error.message}`, true);
        console.error('Encryption error:', error);
    } finally {
        symEncryptBtn.disabled = false;
        symEncryptBtn.textContent = '🔒 Encrypt & Store';
    }
});

// Decrypt from CID/ID
async function performSymDecryption() {
    const cid = symCidInput.value.trim();
    if (!cid) {
        setSymStatus('⚠️ Please enter a CID or ID to decrypt.', true);
        symCidInput.focus();
        return;
    }
    
    try {
        setSymStatus('⏳ Fetching from storage...');
        symDecryptCidBtn.disabled = true;
        symDecryptCidBtn.textContent = '⏳ Decrypting...';
        
        const key = symKey.value.trim();
        if (!key) {
            throw new Error('Please enter the secret key used for encryption.');
        }
        
        console.log('📥 Fetching ID:', cid);
        
        const encrypted = await fetchFromIpfs(cid);
        
        console.log('📦 Retrieved encrypted data length:', encrypted.length);
        console.log('🔑 Attempting decryption...');
        
        const decrypted = symDecrypt(encrypted, key);
        const parsed = parseDecryptedData(decrypted);
        
        if (parsed.type === 'file') {
            downloadFromBase64(parsed.content, parsed.filename);
            setSymStatus(`✅ File "${parsed.filename}" decrypted and downloaded successfully.`);
        } else {
            symText.value = parsed.content;
            const preview = parsed.content.length > 100 
                ? parsed.content.substring(0, 100) + '...' 
                : parsed.content;
            setSymStatus(`✅ Decrypted text: ${preview}`);
        }
        
    } catch (error) {
        setSymStatus(`❌ ${error.message}`, true);
        console.error('Decryption error:', error);
    } finally {
        symDecryptCidBtn.disabled = false;
        symDecryptCidBtn.textContent = 'Decrypt';
    }
}

// Event listeners for decrypt
symDecryptBtn.addEventListener('click', performSymDecryption);
symDecryptCidBtn.addEventListener('click', performSymDecryption);

// File input handler
symFileInput.addEventListener('change', function() {
    if (this.files.length > 0) {
        const file = this.files[0];
        setSymStatus(`📎 File loaded: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
        symText.value = '';
    }
});

// ========== EXPORT / IMPORT FUNCTIONS ==========

// Export Encrypted Data
if (symExportDataBtn) {
    symExportDataBtn.addEventListener('click', () => {
        const cid = symCidInput.value.trim();
        if (!cid) {
            setSymStatus('⚠️ No data to export. Encrypt something first.', true);
            return;
        }
        
        // Get the stored data
        let dataToExport = null;
        let dataSource = '';
        
        // Try localStorage first (for local IDs)
        if (cid.startsWith('local-')) {
            const store = JSON.parse(localStorage.getItem('encrypted_data') || '{}');
            if (store[cid]) {
                dataToExport = store[cid].data;
                dataSource = 'local storage';
            }
        }
        
        // If not found in localStorage, try to fetch from IPFS
        if (!dataToExport) {
            // We'll fetch it
            setSymStatus('⏳ Fetching data from IPFS for export...');
            fetchFromIpfs(cid).then(data => {
                dataToExport = data;
                dataSource = 'IPFS';
                doExport(cid, dataToExport, dataSource);
            }).catch(error => {
                setSymStatus(`❌ Failed to fetch data: ${error.message}`, true);
            });
            return;
        }
        
        doExport(cid, dataToExport, dataSource);
    });
}

function doExport(cid, data, source) {
    const exportData = {
        id: cid,
        data: data,
        timestamp: new Date().toISOString(),
        type: 'symmetric_encrypted',
        source: source || 'unknown',
        version: '1.0'
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `encrypted_data_${cid.substring(0, 12)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setSymStatus(`📤 Encrypted data exported! Source: ${source}`);
}

// Import Encrypted Data
if (symImportDataBtn) {
    symImportDataBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.onchange = function(e) {
            const file = this.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (data.id && data.data) {
                        // Store the data locally
                        const store = JSON.parse(localStorage.getItem('encrypted_data') || '{}');
                        store[data.id] = {
                            data: data.data,
                            timestamp: data.timestamp || new Date().toISOString(),
                            imported: true
                        };
                        localStorage.setItem('encrypted_data', JSON.stringify(store));
                        
                        symCidInput.value = data.id;
                        symCidDisplay.textContent = `📥 Imported: ${data.id}`;
                        setSymStatus('✅ Encrypted data imported! Click "Decrypt" to read it.');
                    } else {
                        throw new Error('Invalid encrypted data file');
                    }
                } catch (error) {
                    setSymStatus('❌ Invalid encrypted data file: ' + error.message, true);
                    console.error(error);
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    });
}

// Copy ID to clipboard
if (symCopyIdBtn) {
    symCopyIdBtn.addEventListener('click', () => {
        const cid = symCidInput.value.trim();
        if (!cid) {
            setSymStatus('⚠️ No ID to copy.', true);
            return;
        }
        navigator.clipboard.writeText(cid).then(() => {
            setSymStatus('✅ ID copied to clipboard!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = cid;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setSymStatus('✅ ID copied!');
        });
    });
}

// Initial status
setSymStatus('✅ Ready. Enter text or select a file to encrypt.');
console.log('🔐 Symmetric encryption ready');