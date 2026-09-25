
// ========== BLOCKCHAIN INTEGRATION ==========
// Connects the app to the EncryptedStorage smart contract on Sepolia

const CONTRACT_ADDRESS = '0x63182bbeaB223A5275458E1Daa69A6e6562D3042';

// The ABI from the verified contract
const CONTRACT_ABI = [
    {
        "anonymous": false,
        "inputs": [
            { "indexed": false, "internalType": "string", "name": "cid", "type": "string" },
            { "indexed": true, "internalType": "address", "name": "by", "type": "address" }
        ],
        "name": "CIDStored",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "getCID",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "latestCID",
        "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "internalType": "string", "name": "_cid", "type": "string" }],
        "name": "storeCID",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

let web3Provider = null;
let web3Signer = null;
let contract = null;

/**
 * Connect to MetaMask and prepare the contract
 */
async function connectToBlockchain() {
    if (!window.ethereum) {
        throw new Error('MetaMask not detected. Please install MetaMask.');
    }

    // Request account access
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    // Create ethers provider and signer
    web3Provider = new ethers.BrowserProvider(window.ethereum);
    web3Signer = await web3Provider.getSigner();
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Signer);

    const network = await web3Provider.getNetwork();
    console.log('✅ Connected to blockchain:', network.name, 'chainId:', network.chainId);

    return {
        address: accounts[0],
        chainId: network.chainId.toString(),
        network: network.name
    };
}

/**
 * Store a CID on the blockchain via MetaMask transaction
 */
async function storeCIDOnChain(cid) {
    if (!contract) {
        await connectToBlockchain();
    }

    console.log('📝 Storing CID on blockchain:', cid);
    
    // Call the smart contract function
    const tx = await contract.storeCID(cid);
    console.log('⏳ Transaction sent:', tx.hash);

    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

    return {
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        etherscanUrl: `https://sepolia.etherscan.io/tx/${tx.hash}`
    };
}

/**
 * Read the latest CID from the blockchain (free, no MetaMask needed)
 */
async function getCIDFromChain() {
    // Use a public RPC provider for read-only calls
    const readProvider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
    const readContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider);
    
    const cid = await readContract.getCID();
    return cid;
}

// Make functions globally available
window.connectToBlockchain = connectToBlockchain;
window.storeCIDOnChain = storeCIDOnChain;
window.getCIDFromChain = getCIDFromChain;