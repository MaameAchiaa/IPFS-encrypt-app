// Asymmetric Encryption (RSA) Logic + Hybrid Encryption (AES + RSA)

let rsaPublicKey = null;
let rsaPrivateKey = null;
let recipientPublicKey = null;
let lastEncryptedData = null;
let keysInitialized = false;
let userProvidedPrivateKey = null;

/**
 * Generate RSA key pair (2048-bit)
 */
function generateRsaKeyPair() {
    try {
        const crypt = new JSEncrypt({ default_key_size: 2048 });
        const privateKey = crypt.getPrivateKey();
        const publicKey = crypt.getPublicKey();
        
        if (!privateKey || !publicKey) {
            throw new Error('Failed to generate RSA key pair.');
        }
        
        return { publicKey, privateKey };
    } catch (error) {
        throw new Error('Key generation failed: ' + error.message);
    }
}

/**
 * Clean a key (handle literal \n from JSON exports and surrounding quotes)
 */
function cleanKey(key) {
    if (!key) return '';
    return key.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
}

/**
 * Encrypt text using RSA public key
 */
function asymEncrypt(plaintext, publicKey) {
    try {
        const crypt = new JSEncrypt();
        crypt.setPublicKey(cleanKey(publicKey));
        const encrypted = crypt.encrypt(plaintext);
        if (!encrypted) {
            throw new Error('RSA encryption failed. Data may be too large (max 245 bytes).');
        }
        return encrypted;
    } catch (error) {
        throw new Error('Encryption failed: ' + error.message);
    }
}

/**
 * Decrypt RSA ciphertext using private key
 */
function asymDecrypt(ciphertext, privateKey) {
    try {
        const crypt = new JSEncrypt();
        crypt.setPrivateKey(cleanKey(privateKey));
        const decrypted = crypt.decrypt(ciphertext);
        if (!decrypted) {
            throw new Error('RSA decryption failed. Invalid private key or corrupted data.');
        }
        return decrypted;
    } catch (error) {
        throw new Error('Decryption failed: ' + error.message);
    }
}

// ========== HYBRID ENCRYPTION (AES + RSA) ==========

/**
 * Generate a random AES key (256-bit)
 */
function generateAESKey() {
    return CryptoJS.lib.WordArray.random(32).toString();
}

/**
 * Hybrid Encrypt:
 * 1. Generate random AES key
 * 2. Encrypt message with AES
 * 3. Encrypt AES key with RSA public key
 * 4. Return combined payload
 */
function hybridEncrypt(plaintext, rsaPublicKeyParam) {
    try {
        // Step 1: Generate random AES key
        const aesKey = generateAESKey();
        console.log('🔑 Generated AES key:', aesKey.substring(0, 16) + '...');
        
        // Step 2: Encrypt message with AES
        const aesEncrypted = CryptoJS.AES.encrypt(plaintext, aesKey).toString();
        console.log('🔒 AES encrypted message length:', aesEncrypted.length);
        
        // Step 3: Encrypt the AES key with RSA public key
        const rsaCrypt = new JSEncrypt();
        rsaCrypt.setPublicKey(cleanKey(rsaPublicKeyParam));
        const encryptedAESKey = rsaCrypt.encrypt(aesKey);
        
        if (!encryptedAESKey) {
            throw new Error('Failed to encrypt AES key with RSA');
        }
        console.log('🔐 RSA encrypted AES key length:', encryptedAESKey.length);
        
        // Step 4: Combine into single payload
        const payload = JSON.stringify({
            type: 'hybrid',
            v: 1,
            data: aesEncrypted,
            key: encryptedAESKey
        });
        
        return payload;
    } catch (error) {
        throw new Error('Hybrid encryption failed: ' + error.message);
    }
}

/**
 * Hybrid Decrypt:
 * 1. Parse payload
 * 2. Decrypt AES key with RSA private key
 * 3. Decrypt message with recovered AES key
 */
function hybridDecrypt(payloadStr, rsaPrivateKeyParam) {
    try {
        const payload = JSON.parse(payloadStr);
        
        if (payload.type !== 'hybrid') {
            throw new Error('Not a hybrid-encrypted payload');
        }
        
        // Step 2: Decrypt AES key with RSA private key
        const rsaCrypt = new JSEncrypt();
        rsaCrypt.setPrivateKey(cleanKey(rsaPrivateKeyParam));
        const aesKey = rsaCrypt.decrypt(payload.key);
        
        if (!aesKey) {
            throw new Error('Failed to decrypt AES key — wrong private key?');
        }
        console.log('🔑 Recovered AES key:', aesKey.substring(0, 16) + '...');
        
        // Step 3: Decrypt message with recovered AES key
        const bytes = CryptoJS.AES.decrypt(payload.data, aesKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decrypted) {
            throw new Error('Failed to decrypt message with AES');
        }
        
        return decrypted;
    } catch (error) {
        throw new Error('Hybrid decryption failed: ' + error.message);
    }
}

// DOM Elements
const asymText = document.getElementById('asymText');
const asymFileInput = document.getElementById('asymFileInput');
const asymEncryptBtn = document.getElementById('asymEncryptBtn');
const asymDecryptBtn = document.getElementById('asymDecryptBtn');
const asymCidInput = document.getElementById('asymCidInput');
const asymDecryptCidBtn = document.getElementById('asymDecryptCidBtn');
const asymStatus = document.getElementById('asymStatus');
const asymCidDisplay = document.getElementById('asymCidDisplay');
const asymPubKeyPreview = document.getElementById('asymPubKeyPreview');
const asymPrivKeyPreview = document.getElementById('asymPrivKeyPreview');
const genRsaKeyBtn = document.getElementById('genRsaKeyBtn');
const copyPubKeyBtn = document.getElementById('copyPubKeyBtn');
const exportKeysBtn = document.getElementById('exportKeysBtn');
const importPubKeyBtn = document.getElementById('importPubKeyBtn');
const recipientPubKey = document.getElementById('recipientPubKey');
const recipientKeyStatus = document.getElementById('recipientKeyStatus');
const clearRecipientKeyBtn = document.getElementById('clearRecipientKeyBtn');
const charCount = document.getElementById('charCount');
const modeHelp = document.getElementById('modeHelp');
const asymExportDataBtn = document.getElementById('asymExportDataBtn');
const asymImportDataBtn = document.getElementById('asymImportDataBtn');
const asymCopyIdBtn = document.getElementById('asymCopyIdBtn');

// Private key input elements
const privateKeyGroup = document.getElementById('privateKeyGroup');
const asymPrivateKeyInput = document.getElementById('asymPrivateKeyInput');
const loadPrivateKeyBtn = document.getElementById('loadPrivateKeyBtn');
const privateKeyStatus = document.getElementById('privateKeyStatus');

function setAsymStatus(message, isError = false) {
    if (asymStatus) {
        asymStatus.textContent = message;
        asymStatus.className = 'status-box' + (isError ? ' error' : '');
    }
    console.log((isError ? '❌' : '✅'), message);
}

// Update key preview in UI
function updateKeyPreview() {
    if (asymPubKeyPreview) {
        if (rsaPublicKey) {
            const pubShort = rsaPublicKey.length > 80 
                ? rsaPublicKey.substring(0, 70) + '…' 
                : rsaPublicKey;
            asymPubKeyPreview.textContent = pubShort;
            asymPubKeyPreview.style.color = '#28a745';
        } else {
            asymPubKeyPreview.textContent = '— No key generated —';
            asymPubKeyPreview.style.color = '#6c757d';
        }
    }
    
    if (asymPrivKeyPreview) {
        if (rsaPrivateKey) {
            const privShort = rsaPrivateKey.length > 80 
                ? rsaPrivateKey.substring(0, 70) + '…' 
                : rsaPrivateKey;
            asymPrivKeyPreview.textContent = privShort;
            asymPrivKeyPreview.style.color = '#dc3545';
        } else {
            asymPrivKeyPreview.textContent = '— No key generated —';
            asymPrivKeyPreview.style.color = '#6c757d';
        }
    }
}

// Initialize keys
function initRsaKeys() {
    try {
        setAsymStatus('⏳ Generating RSA key pair...');
        
        const pair = generateRsaKeyPair();
        rsaPublicKey = pair.publicKey;
        rsaPrivateKey = pair.privateKey;
        keysInitialized = true;
        updateKeyPreview();
        setAsymStatus('✅ RSA key pair generated successfully! (2048-bit)');
        console.log('✅ RSA Keys generated and displayed');
        
    } catch (error) {
        setAsymStatus(`❌ ${error.message}`, true);
        console.error('Key generation error:', error);
    }
}

// Generate new keys
if (genRsaKeyBtn) {
    genRsaKeyBtn.addEventListener('click', () => {
        if (confirm('Generating new keys will make old encrypted data undecryptable. Continue?')) {
            initRsaKeys();
            if (recipientPubKey) {
                recipientPubKey.value = '';
                recipientPublicKey = null;
                if (recipientKeyStatus) {
                    recipientKeyStatus.textContent = 'No recipient key loaded';
                    recipientKeyStatus.style.color = '#6c757d';
                }
            }
            if (asymPrivateKeyInput) asymPrivateKeyInput.value = '';
            userProvidedPrivateKey = null;
            if (privateKeyStatus) {
                privateKeyStatus.textContent = 'No private key loaded';
                privateKeyStatus.style.color = '#856404';
            }
        }
    });
}

// Copy Public Key
if (copyPubKeyBtn) {
    copyPubKeyBtn.addEventListener('click', () => {
        if (!rsaPublicKey) {
            setAsymStatus('⚠️ No public key to copy. Generate keys first.', true);
            return;
        }
        navigator.clipboard.writeText(rsaPublicKey).then(() => {
            setAsymStatus('✅ Your public key copied to clipboard! Share it with others.');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = rsaPublicKey;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setAsymStatus('✅ Your public key copied!');
        });
    });
}

// Export Keys
if (exportKeysBtn) {
    exportKeysBtn.addEventListener('click', () => {
        if (!rsaPublicKey || !rsaPrivateKey) {
            setAsymStatus('⚠️ No keys to export. Generate keys first.', true);
            return;
        }
        
        const keys = {
            publicKey: rsaPublicKey,
            privateKey: rsaPrivateKey,
            generated: new Date().toISOString(),
            type: 'RSA-2048',
            note: 'Keep this file SECURE! Anyone with your private key can decrypt your data.'
        };
        
        const blob = new Blob([JSON.stringify(keys, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rsa_keys_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setAsymStatus('✅ Keys exported successfully! Store this file safely.');
    });
}

// Import Public Key
if (importPubKeyBtn) {
    importPubKeyBtn.addEventListener('click', () => {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.txt';
        fileInput.onchange = function(e) {
            const file = this.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const content = event.target.result;
                    let pubKey = content;
                    
                    try {
                        const json = JSON.parse(content);
                        if (json.publicKey) {
                            pubKey = json.publicKey;
                        }
                    } catch (e) {
                        // Not JSON, use as is
                    }
                    
                    pubKey = cleanKey(pubKey);
                    
                    if (pubKey.includes('BEGIN PUBLIC KEY') || pubKey.includes('MIGf')) {
                        if (recipientPubKey) {
                            recipientPubKey.value = pubKey;
                        }
                        recipientPublicKey = pubKey;
                        if (recipientKeyStatus) {
                            recipientKeyStatus.textContent = '✅ Recipient public key loaded!';
                            recipientKeyStatus.style.color = '#28a745';
                        }
                        setAsymStatus('✅ Recipient public key imported successfully!');
                        console.log('✅ Public key imported and cleaned');
                    } else {
                        throw new Error('Invalid public key format');
                    }
                } catch (error) {
                    setAsymStatus('❌ Invalid public key file.', true);
                    if (recipientKeyStatus) {
                        recipientKeyStatus.textContent = '❌ Invalid key';
                        recipientKeyStatus.style.color = '#dc3545';
                    }
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    });
}

// Clear recipient key
if (clearRecipientKeyBtn) {
    clearRecipientKeyBtn.addEventListener('click', () => {
        if (recipientPubKey) {
            recipientPubKey.value = '';
        }
        recipientPublicKey = null;
        if (recipientKeyStatus) {
            recipientKeyStatus.textContent = 'No recipient key loaded';
            recipientKeyStatus.style.color = '#6c757d';
        }
        setAsymStatus('✅ Recipient key cleared');
    });
}

// Auto-detect recipient key changes
if (recipientPubKey) {
    recipientPubKey.addEventListener('input', function() {
        let value = cleanKey(this.value.trim());
        
        if (value && (value.includes('BEGIN PUBLIC KEY') || value.includes('MIGf'))) {
            recipientPublicKey = value;
            if (recipientKeyStatus) {
                recipientKeyStatus.textContent = '✅ Recipient public key loaded!';
                recipientKeyStatus.style.color = '#28a745';
            }
        } else if (value) {
            recipientPublicKey = null;
            if (recipientKeyStatus) {
                recipientKeyStatus.textContent = '⚠️ Invalid public key format';
                recipientKeyStatus.style.color = '#ffc107';
            }
        } else {
            recipientPublicKey = null;
            if (recipientKeyStatus) {
                recipientKeyStatus.textContent = 'No recipient key loaded';
                recipientKeyStatus.style.color = '#6c757d';
            }
        }
    });
}

// Load Private Key button
if (loadPrivateKeyBtn) {
    loadPrivateKeyBtn.addEventListener('click', () => {
        let key = asymPrivateKeyInput ? asymPrivateKeyInput.value.trim() : '';
        
        if (!key) {
            privateKeyStatus.textContent = '⚠️ Please paste a private key first.';
            privateKeyStatus.style.color = '#dc3545';
            return;
        }
        
        key = cleanKey(key);
        
        if (!key.includes('BEGIN RSA PRIVATE KEY') && !key.includes('BEGIN PRIVATE KEY')) {
            privateKeyStatus.textContent = '❌ Invalid private key format.';
            privateKeyStatus.style.color = '#dc3545';
            return;
        }
        
        userProvidedPrivateKey = key;
        privateKeyStatus.textContent = '✅ Private key loaded. You can now decrypt.';
        privateKeyStatus.style.color = '#28a745';
        setAsymStatus('✅ Private key loaded successfully.');
    });
}

// Character counter
if (asymText) {
    asymText.addEventListener('input', function() {
        const length = this.value.length;
        const mode = document.querySelector('input[name="encryptMode"]:checked')?.value || 'self';
        
        if (charCount) {
            if (mode === 'hybrid') {
                charCount.textContent = `${length} characters (no limit in Hybrid mode)`;
                charCount.style.color = '#28a745';
            } else {
                charCount.textContent = `${length} / 245 characters`;
                
                if (length > 245) {
                    charCount.style.color = '#dc3545';
                    charCount.textContent += ' ⚠️ EXCEEDS LIMIT!';
                } else if (length > 200) {
                    charCount.style.color = '#ffc107';
                } else {
                    charCount.style.color = '#6c757d';
                }
            }
        }
    });
}

// Encryption mode change
document.querySelectorAll('input[name="encryptMode"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const mode = this.value;
        if (mode === 'self') {
            if (modeHelp) {
                modeHelp.textContent = '💡 Encrypt for yourself: you\'ll be able to decrypt with your private key';
                modeHelp.style.color = '#28a745';
            }
        } else if (mode === 'hybrid') {
            if (!recipientPublicKey) {
                if (modeHelp) {
                    modeHelp.textContent = '⚠️ Please paste a recipient public key above first!';
                    modeHelp.style.color = '#dc3545';
                }
            } else {
                if (modeHelp) {
                    modeHelp.textContent = '⚡ Hybrid mode: No size limit! Data is AES-encrypted, and the AES key is RSA-encrypted.';
                    modeHelp.style.color = '#0a7a3a';
                }
            }
        } else {
            if (!recipientPublicKey) {
                if (modeHelp) {
                    modeHelp.textContent = '⚠️ Please paste a recipient public key above first!';
                    modeHelp.style.color = '#dc3545';
                }
            } else {
                if (modeHelp) {
                    modeHelp.textContent = '🔐 Encrypting for someone else: only the recipient can decrypt with their private key (max 245 bytes)';
                    modeHelp.style.color = '#dc3545';
                }
            }
        }
        
        // Update char counter immediately
        if (asymText) asymText.dispatchEvent(new Event('input'));
    });
});

// Encrypt and Store
if (asymEncryptBtn) {
    asymEncryptBtn.addEventListener('click', async () => {
        try {
            setAsymStatus('⏳ Processing...');
            asymEncryptBtn.disabled = true;
            asymEncryptBtn.textContent = '⏳ Encrypting...';
            
            const mode = document.querySelector('input[name="encryptMode"]:checked').value;
            let publicKeyToUse;
            let recipientName = 'yourself';
            
            if (mode === 'recipient' || mode === 'hybrid') {
                if (!recipientPublicKey) {
                    throw new Error('Please paste a recipient public key first!');
                }
                publicKeyToUse = recipientPublicKey;
                recipientName = 'the recipient';
            } else {
                if (!rsaPublicKey) {
                    throw new Error('Your public key not available. Generate keys first.');
                }
                publicKeyToUse = rsaPublicKey;
            }
            
            const data = await getInputData(asymText, asymFileInput);
            
            const payload = data.type === 'file'
                ? `file:${data.filename}|${data.content}`
                : `text:${data.content}`;
            
            const payloadSize = new Blob([payload]).size;
            console.log(`📝 Payload size: ${payloadSize} bytes`);
            
            // ========== HYBRID MODE ==========
            let encrypted;
            if (mode === 'hybrid') {
                console.log(`⚡ Hybrid mode — no size limit`);
                setAsymStatus(`⏳ Encrypting with Hybrid (AES+RSA) — ${payloadSize} bytes`);
                encrypted = hybridEncrypt(payload, publicKeyToUse);
            } else {
                // RSA-only mode (245-byte limit)
                if (payloadSize > 245) {
                    throw new Error(`Data too large for RSA-2048 (${payloadSize} bytes). Max 245 bytes. Use Hybrid mode for larger data.`);
                }
                if (data.type === 'file') {
                    setAsymStatus(`⏳ Encrypting file: ${data.filename} for ${recipientName}...`);
                } else {
                    setAsymStatus(`⏳ Encrypting text for ${recipientName}...`);
                }
                encrypted = asymEncrypt(payload, publicKeyToUse);
            }
            
            lastEncryptedData = encrypted;
            
            // Store on IPFS or localStorage
            const cid = await storeToIpfs(encrypted);
            const isIPFS = !cid.startsWith('local-');
            console.log('📦 Storage ID:', cid, isIPFS ? '(IPFS)' : '(Local)');
            
            if (asymCidDisplay) {
                asymCidDisplay.textContent = `✅ ${isIPFS ? 'CID' : 'ID'}: ${cid}`;
            }
            if (asymCidInput) {
                asymCidInput.value = cid;
            }

            // ✅ NEW: Store the CID on the blockchain
            if (isIPFS) {
                try {
                    setAsymStatus('🔗 Storing CID on the blockchain...');
        
        // Ask MetaMask to sign the transaction
        const chainResult = await storeCIDOnChain(cid);
        
        setAsymStatus(
            `✅ Stored on IPFS + Blockchain! ` +
            `TX: ${chainResult.txHash.substring(0, 10)}... ` +
            `(block ${chainResult.blockNumber})`
        );
        
        // Show a link to Etherscan
        if (asymCidDisplay) {
            asymCidDisplay.innerHTML = 
                `✅ CID: ${cid}<br>` +
                `🔗 <a href="${chainResult.etherscanUrl}" target="_blank">View on Etherscan</a>`;
        }
        
        console.log('🎉 Full success — IPFS + Blockchain');
        
    } catch (chainError) {
        console.warn('⚠️ Blockchain storage failed:', chainError);
        setAsymStatus(`✅ Stored on IPFS! ⚠️ Blockchain failed: ${chainError.message}`);
    }
}
            
            if (asymText) asymText.value = '';
            if (asymFileInput) asymFileInput.value = '';
            if (charCount) {
                charCount.textContent = '0 / 245 characters';
                charCount.style.color = '#6c757d';
            }
            
            const modeLabel = mode === 'hybrid' ? '⚡ Hybrid (AES+RSA)' : '🔐 RSA';
            if (mode === 'recipient' || mode === 'hybrid') {
                if (isIPFS) {
                    setAsymStatus(`✅ ${modeLabel} — Encrypted for recipient, stored on IPFS! 📤 Share the CID.`);
                } else {
                    setAsymStatus(`✅ ${modeLabel} — Encrypted for recipient! 📤 Export the data to share.`);
                }
            } else {
                if (isIPFS) {
                    setAsymStatus(`✅ ${modeLabel} — Encrypted for yourself, stored on IPFS! CID: ${cid}`);
                } else {
                    setAsymStatus(`✅ ${modeLabel} — Encrypted for yourself! ID: ${cid}`);
                }
            }
            
        } catch (error) {
            setAsymStatus(`❌ ${error.message}`, true);
            console.error('Encryption error:', error);
        } finally {
            if (asymEncryptBtn) {
                asymEncryptBtn.disabled = false;
                asymEncryptBtn.textContent = '🔒 Encrypt & Store';
            }
        }
    });
}

// Decrypt function — REQUIRES private key input, supports hybrid
async function performAsymDecryption() {
    const cid = asymCidInput ? asymCidInput.value.trim() : '';
    
    if (!cid) {
        setAsymStatus('⚠️ No ID found. Please import or enter an ID.', true);
        return;
    }
    
    // Show the private key input field if hidden
    if (privateKeyGroup) privateKeyGroup.style.display = 'block';
    
    // Get the private key — prefer the loaded one, then the textarea
    let userPrivateKey = userProvidedPrivateKey || (asymPrivateKeyInput ? asymPrivateKeyInput.value.trim() : '');
    userPrivateKey = cleanKey(userPrivateKey);
    
    if (!userPrivateKey) {
        setAsymStatus('🔒 Please paste your private key in the field above, then click Decrypt again.', true);
        if (asymPrivateKeyInput) asymPrivateKeyInput.focus();
        return;
    }
    
    // Validate the private key format
    if (!userPrivateKey.includes('BEGIN RSA PRIVATE KEY') && !userPrivateKey.includes('BEGIN PRIVATE KEY')) {
        setAsymStatus('❌ Invalid private key format. It should start with "-----BEGIN RSA PRIVATE KEY-----"', true);
        return;
    }
    
    try {
        setAsymStatus('⏳ Decrypting with your provided private key...');
        if (asymDecryptBtn) asymDecryptBtn.disabled = true;
        if (asymDecryptCidBtn) asymDecryptCidBtn.disabled = true;
        
        // Fetch encrypted data
        const encrypted = await fetchFromIpfs(cid);
        
        console.log('🔓 Attempting decryption...');
        
        // Detect hybrid vs RSA-only
        let decrypted;
        let method = 'RSA';
        
        try {
            const parsed = JSON.parse(encrypted);
            if (parsed.type === 'hybrid') {
                console.log('⚡ Detected hybrid payload — using AES+RSA decryption');
                setAsymStatus('⚡ Hybrid payload detected — decrypting with AES+RSA...');
                decrypted = hybridDecrypt(encrypted, userPrivateKey);
                method = 'Hybrid (AES+RSA)';
            } else {
                throw new Error('Not hybrid');
            }
        } catch (parseError) {
            // Fall back to RSA-only
            console.log('🔐 Using RSA-only decryption');
            try {
                const crypt = new JSEncrypt();
                crypt.setPrivateKey(userPrivateKey);
                decrypted = crypt.decrypt(encrypted);
                
                if (!decrypted) {
                    throw new Error('Decryption returned empty');
                }
            } catch (decryptError) {
                throw new Error(
                    '❌ Decryption failed.\n\n' +
                    '💡 Possible reasons:\n' +
                    '1. The private key does not match the public key used for encryption\n' +
                    '2. The data was encrypted for a different recipient\n' +
                    '3. The encrypted data is corrupted\n\n' +
                    'Make sure you paste the correct private key.'
                );
            }
        }
        
        // Parse and display
        const parsed = parseDecryptedData(decrypted);
        
        if (parsed.type === 'file') {
            downloadFromBase64(parsed.content, parsed.filename);
            setAsymStatus(`✅ File "${parsed.filename}" decrypted via ${method} and downloaded!`);
            if (asymText) asymText.value = `📁 File downloaded: ${parsed.filename}`;
        } else {
            if (asymText) asymText.value = parsed.content;
            const preview = parsed.content.length > 50 
                ? parsed.content.substring(0, 50) + '...' 
                : parsed.content;
            setAsymStatus(`✅ Decrypted via ${method}! Text: "${preview}"`);
            if (charCount) charCount.textContent = `${parsed.content.length} characters`;
        }
        
    } catch (error) {
        setAsymStatus(`❌ ${error.message}`, true);
        console.error('Decryption error:', error);
    } finally {
        if (asymDecryptBtn) asymDecryptBtn.disabled = false;
        if (asymDecryptCidBtn) asymDecryptCidBtn.disabled = false;
    }
}

// Decrypt event listeners
if (asymDecryptBtn) {
    asymDecryptBtn.addEventListener('click', performAsymDecryption);
}
if (asymDecryptCidBtn) {
    asymDecryptCidBtn.addEventListener('click', performAsymDecryption);
}

// File input handler
if (asymFileInput) {
    asymFileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            const file = this.files[0];
            const sizeKB = (file.size / 1024).toFixed(2);
            const mode = document.querySelector('input[name="encryptMode"]:checked')?.value;
            
            if (mode !== 'hybrid' && file.size > 200) {
                setAsymStatus(`⚠️ File is ${sizeKB} KB. RSA limit is ~245 bytes. Use ⚡ Hybrid mode!`, true);
            } else {
                setAsymStatus(`📎 File loaded: ${file.name} (${sizeKB} KB)`);
            }
            
            if (asymText) asymText.value = '';
            if (charCount) charCount.textContent = '0 / 245 characters';
        }
    });
}

// Text input handler
if (asymText) {
    asymText.addEventListener('input', function() {
        if (this.value.trim()) {
            if (asymFileInput) asymFileInput.value = '';
        }
    });
}

// ========== EXPORT / IMPORT FUNCTIONS ==========

// Export Encrypted Data
if (asymExportDataBtn) {
    asymExportDataBtn.addEventListener('click', () => {
        const cid = asymCidInput ? asymCidInput.value.trim() : '';
        if (!cid) {
            setAsymStatus('⚠️ No data to export. Encrypt something first.', true);
            return;
        }
        
        let dataToExport = null;
        let dataSource = '';
        
        // Try localStorage first
        if (cid.startsWith('local-')) {
            const store = JSON.parse(localStorage.getItem('encrypted_data') || '{}');
            if (store[cid]) {
                dataToExport = store[cid].data;
                dataSource = 'local storage';
            }
        }
        
        // If not found, try to fetch
        if (!dataToExport) {
            setAsymStatus('⏳ Fetching data from IPFS for export...');
            fetchFromIpfs(cid).then(data => {
                dataToExport = data;
                dataSource = 'IPFS';
                doAsymExport(cid, dataToExport, dataSource);
            }).catch(error => {
                setAsymStatus(`❌ Failed to fetch data: ${error.message}`, true);
            });
            return;
        }
        
        doAsymExport(cid, dataToExport, dataSource);
    });
}

function doAsymExport(cid, data, source) {
    // Detect hybrid vs RSA-only for the export metadata
    let encType = 'asymmetric_encrypted';
    try {
        const p = JSON.parse(data);
        if (p.type === 'hybrid') encType = 'hybrid_encrypted';
    } catch (e) { /* not hybrid */ }
    
    const exportData = {
        id: cid,
        data: data,
        timestamp: new Date().toISOString(),
        type: encType,
        source: source || 'unknown',
        version: '1.0',
        note: 'This data is encrypted. Only the holder of the matching private key can decrypt it.'
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
    setAsymStatus(`📤 Encrypted data exported (${encType})! Source: ${source}`);
}

// Import Encrypted Data
if (asymImportDataBtn) {
    asymImportDataBtn.addEventListener('click', () => {
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
                        const store = JSON.parse(localStorage.getItem('encrypted_data') || '{}');
                        store[data.id] = {
                            data: data.data,
                            timestamp: data.timestamp || new Date().toISOString(),
                            imported: true
                        };
                        localStorage.setItem('encrypted_data', JSON.stringify(store));
                        
                        if (asymCidInput) asymCidInput.value = data.id;
                        if (asymCidDisplay) asymCidDisplay.textContent = `📥 Imported: ${data.id}`;
                        setAsymStatus('✅ Encrypted data imported! Paste your private key and click "Decrypt".');
                        
                        // Show the private key input so the user knows they need to provide it
                        if (privateKeyGroup) privateKeyGroup.style.display = 'block';
                    } else {
                        throw new Error('Invalid encrypted data file');
                    }
                } catch (error) {
                    setAsymStatus('❌ Invalid encrypted data file: ' + error.message, true);
                    console.error(error);
                }
            };
            reader.readAsText(file);
        };
        fileInput.click();
    });
}

// Copy ID to clipboard
if (asymCopyIdBtn) {
    asymCopyIdBtn.addEventListener('click', () => {
        const cid = asymCidInput ? asymCidInput.value.trim() : '';
        if (!cid) {
            setAsymStatus('⚠️ No ID to copy.', true);
            return;
        }
        navigator.clipboard.writeText(cid).then(() => {
            setAsymStatus('✅ ID copied to clipboard!');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = cid;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setAsymStatus('✅ ID copied!');
        });
    });
}

// ========== INITIALIZATION ==========

initRsaKeys();

setAsymStatus('✅ Ready. Your keys are generated. Try encrypting for yourself, someone else, or use ⚡ Hybrid mode!');
console.log('🔐 Asymmetric encryption ready (with Hybrid AES+RSA support)');