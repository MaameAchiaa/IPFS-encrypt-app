// IPFS Integration - Works with IPFS Desktop or Local Node

let ipfs = null;
let ipfsConnected = false;
let usingLocalStorage = false;

/**
 * Initialize IPFS - Try to connect to local node first
 */
async function initIPFS() {
    const statusElement = document.getElementById('ipfsStatus');
    if (statusElement) {
        statusElement.innerHTML = '⏳ Connecting to IPFS...';
        statusElement.style.background = '#fff3cd';
        statusElement.style.borderLeftColor = '#ffc107';
    }

    // Try to connect to local IPFS node
    try {
        console.log('🌐 Trying to connect to local IPFS node at http://localhost:5002...');
        
        // First check if IPFS is running using a simple fetch
        const checkResponse = await fetch('http://localhost:5002/api/v0/version', {
            method: 'POST',
            signal: AbortSignal.timeout(3000)
        });
        
        if (checkResponse.ok) {
            const versionData = await checkResponse.json();
            console.log('✅ IPFS daemon is running, version:', versionData.Version);
            
            // Create IPFS client using the correct method
            try {
                // Try the newer API
                ipfs = window.IpfsHttpClient.create({
                   url: 'http://localhost:5002/api/v0'
                });
            } catch (clientError) {
                console.warn('⚠️ Client creation with new API failed, trying alternative...');
                // Fallback for older versions
                ipfs = new window.IpfsHttpClient({
                    host: 'localhost',
                    port: '5002',
                    protocol: 'http'
                });
            }

            // Test with a small file
            const testData = 'ipfs-test-' + Date.now();
            const encoder = new TextEncoder();
            const bytes = encoder.encode(testData);
            const result = await ipfs.add(bytes);
            
            if (result && result.cid) {
                ipfsConnected = true;
                usingLocalStorage = false;
                
                if (statusElement) {
                    statusElement.innerHTML = '✅ Connected to IPFS (Local Node)';
                    statusElement.style.background = '#d4edda';
                    statusElement.style.borderLeftColor = '#28a745';
                }
                console.log('✅ Connected to local IPFS node, test CID:', result.cid.toString());
                
                // Try to pin the test data
                try {
                    await ipfs.pin.add(result.cid.toString());
                    console.log('✅ IPFS pinning works');
                } catch (pinError) {
                    console.log('ℹ️ Pinning not available (may need to enable in IPFS Desktop)');
                }
                
                return true;
            }
        }
    } catch (error) {
        console.warn('⚠️ Local IPFS not available:', error.message);
        if (statusElement) {
            statusElement.innerHTML = '⚠️ IPFS not connected. Please start IPFS Desktop.';
            statusElement.style.background = '#fff3cd';
            statusElement.style.borderLeftColor = '#ffc107';
        }
    }

    // Fallback: Use localStorage
    if (statusElement) {
        statusElement.innerHTML = '📦 IPFS unavailable - Using local storage (export to share)';
        statusElement.style.background = '#d4edda';
        statusElement.style.borderLeftColor = '#28a745';
    }
    ipfsConnected = false;
    usingLocalStorage = true;
    console.log('📦 Using localStorage fallback');
    return true;
}

/**
 * Store data on IPFS (or localStorage fallback)
 */
async function storeToIpfs(data) {
    // If IPFS is connected, use it
    if (ipfs && ipfsConnected) {
        try {
            console.log('📤 Storing on IPFS...');
            const encoder = new TextEncoder();
            const bytes = encoder.encode(data);
            const result = await ipfs.add(bytes);
            const cid = result.cid.toString();
            
            // Try to pin the data (makes it persistent)
            try {
                await ipfs.pin.add(cid);
                console.log('📌 Pinned data on IPFS');
            } catch (pinError) {
                console.log('ℹ️ Could not pin (may need to enable in IPFS Desktop)');
            }
            
            console.log('✅ Stored on IPFS, CID:', cid);
            return cid;
        } catch (error) {
            console.warn('⚠️ IPFS storage failed, falling back to localStorage:', error);
        }
    }

    // Fallback: localStorage (always works)
    const id = 'local-' + Date.now() + '-' + Math.random().toString(36).substring(2, 10);
    
    try {
        const store = JSON.parse(localStorage.getItem('encrypted_data') || '{}');
        store[id] = {
            data: data,
            timestamp: new Date().toISOString(),
            note: 'Stored locally (IPFS unavailable)'
        };
        localStorage.setItem('encrypted_data', JSON.stringify(store));
        console.log('📦 Stored locally with ID:', id);
        return id;
    } catch (error) {
        throw new Error('Failed to store data: ' + error.message);
    }
}

/**
 * Fetch data from IPFS (or localStorage fallback)
 */
async function fetchFromIpfs(cid) {
    if (!cid) {
        throw new Error('Invalid ID/CID');
    }

    // If it's a local ID, try localStorage first
    if (cid.startsWith('local-')) {
        try {
            const store = JSON.parse(localStorage.getItem('encrypted_data') || '{}');
            if (store[cid]) {
                console.log('📦 Retrieved from localStorage');
                return store[cid].data;
            }
        } catch (error) {
            console.warn('⚠️ localStorage fetch failed:', error);
        }
    }

    // Try IPFS client
    if (ipfs && ipfsConnected) {
        try {
            console.log('📥 Fetching from IPFS client...');
            const chunks = [];
            for await (const chunk of ipfs.cat(cid)) {
                chunks.push(chunk);
            }
            const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
            const buffer = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                buffer.set(chunk, offset);
                offset += chunk.length;
            }
            const data = new TextDecoder().decode(buffer);
            console.log('✅ Retrieved from IPFS');
            return data;
        } catch (error) {
            console.warn('⚠️ IPFS fetch failed:', error);
        }
    }

    // Try public gateways (if it's an IPFS CID)
    if (cid.startsWith('Qm') || cid.startsWith('bafy')) {
        const gateways = [
            `https://ipfs.io/ipfs/${cid}`,
            `https://cloudflare-ipfs.com/ipfs/${cid}`,
            `https://gateway.pinata.cloud/ipfs/${cid}`,
            `https://dweb.link/ipfs/${cid}`
        ];

        for (const url of gateways) {
            try {
                console.log('📥 Fetching from gateway:', url);
                const response = await fetch(url);
                if (response.ok) {
                    const data = await response.text();
                    console.log('✅ Retrieved from gateway');
                    return data;
                }
            } catch (error) {
                console.warn('⚠️ Gateway failed:', error.message);
            }
        }
    }

    throw new Error('Data not found. Please check the ID/CID and try again.');
}

// Helper functions (unchanged)
async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function downloadFromBase64(base64, filename) {
    try {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'decrypted_file';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        throw new Error(`Failed to download file: ${error.message}`);
    }
}

async function getInputData(textarea, fileInput) {
    if (fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const base64 = await fileToBase64(file);
        return {
            type: 'file',
            content: base64,
            filename: file.name
        };
    } else {
        const text = textarea ? textarea.value.trim() : '';
        if (!text) {
            throw new Error('Please enter text or select a file.');
        }
        return {
            type: 'text',
            content: text
        };
    }
}

function parseDecryptedData(data) {
    if (data.startsWith('file:')) {
        const parts = data.split('|');
        const filename = parts[0].replace('file:', '');
        const base64Content = parts.slice(1).join('|');
        return {
            type: 'file',
            content: base64Content,
            filename: filename
        };
    } else {
        const textContent = data.startsWith('text:') ? data.substring(5) : data;
        return {
            type: 'text',
            content: textContent
        };
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initIPFS();
});

// Make functions globally available
window.initIPFS = initIPFS;
window.storeToIpfs = storeToIpfs;
window.fetchFromIpfs = fetchFromIpfs;
window.ipfsConnected = ipfsConnected;
window.usingLocalStorage = usingLocalStorage;