document.addEventListener('DOMContentLoaded', () => {
    const addressField = document.querySelector('.address-field');
    const checkButton = document.querySelector('.check-btn');
    const connectButton = document.querySelector('.connect-btn');
    const connectWalletBtn = document.getElementById('connectWallet');
    const walletStatus = document.querySelector('.wallet-status');
    const eligibilitySection = document.querySelector('.eligibility-section');
    const connectedAddress = document.getElementById('connectedAddress');
    const tokenAmount = document.getElementById('tokenAmount');
    const statusCircle = document.querySelector('.status-circle');
    const statusText = document.querySelector('.status-text');

    let isConnected = false;

    // Handle address check
    checkButton.addEventListener('click', async () => {
        const address = addressField.value;
        if (!address || !address.startsWith('0x')) {
            alert('Please enter a valid Ethereum address');
            return;
        }
        
        // Simulate checking address
        checkButton.textContent = 'Checking...';
        await new Promise(resolve => setTimeout(resolve, 1500));
        checkButton.textContent = 'CHECK';
    });
    
    // Handle wallet connection
    connectButton.addEventListener('click', async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                connectButton.textContent = 'Connected';
            } catch (error) {
                console.error('Error connecting wallet:', error);
                alert('Error connecting wallet');
            }
        } else {
            alert('Please install MetaMask');
            window.open('https://metamask.io/download.html', '_blank');
        }
    });
    
    // Update ticker prices (simulation)
    function updateTicker() {
        const tickers = document.querySelectorAll('.ticker-item');
        tickers.forEach(ticker => {
            const priceSpan = ticker.querySelector('span:first-child');
            const changeSpan = ticker.querySelector('span:last-child');
            
            // Get current price
            const currentPrice = parseFloat(priceSpan.textContent.split('$')[1]);
            
            // Random price change (-1% to +1%)
            const change = (Math.random() * 2 - 1) * 0.01;
            const newPrice = currentPrice * (1 + change);
            
            // Update price and change indicator
            priceSpan.textContent = `${priceSpan.textContent.split('$')[0]} $${newPrice.toFixed(2)}`;
            const isPositive = change >= 0;
            changeSpan.textContent = `${isPositive ? '▲' : '▼'} ${Math.abs(change * 100).toFixed(2)}%`;
            changeSpan.className = isPositive ? 'green' : 'red';
        });
    }
    
    // Update ticker every 30 seconds
    setInterval(updateTicker, 30000);

    const connectWallet = async () => {
        if (typeof window.ethereum !== 'undefined') {
            try {
                // Request account access
                const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
                const account = accounts[0];
                
                // Update UI
                isConnected = true;
                connectWalletBtn.textContent = 'Wallet Connected';
                walletStatus.textContent = 'Connected to MetaMask';
                eligibilitySection.classList.remove('hidden');
                connectedAddress.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;

                // Simulate checking eligibility
                checkEligibility(account);
            } catch (error) {
                console.error('Error connecting wallet:', error);
                walletStatus.textContent = 'Error connecting wallet';
            }
        } else {
            walletStatus.textContent = 'Please install MetaMask';
            window.open('https://metamask.io/download.html', '_blank');
        }
    };

    const checkEligibility = async (address) => {
        // Simulate API call to check eligibility
        setTimeout(() => {
            // This is just a simulation - in a real app, you would check against your backend
            const isEligible = Math.random() > 0.5;
            const tokens = isEligible ? Math.floor(Math.random() * 10000) : 0;

            statusCircle.classList.add(isEligible ? 'eligible' : 'not-eligible');
            statusText.textContent = isEligible ? 'Eligible' : 'Not Eligible';
            tokenAmount.textContent = isEligible ? `${tokens} DERIVE` : '0 DERIVE';
        }, 2000);
    };

    const checkEligibilityMessage = () => {
        const walletInput = document.getElementById('wallet-input');
        const message = document.getElementById('eligibility-message');
        
        if (walletInput.value.trim() !== '') {
            message.classList.add('visible');
        } else {
            message.classList.remove('visible');
        }
    };

    connectWalletBtn.addEventListener('click', connectWallet);

    // Listen for account changes
    if (typeof window.ethereum !== 'undefined') {
        window.ethereum.on('accountsChanged', (accounts) => {
            if (accounts.length === 0) {
                // User disconnected wallet
                isConnected = false;
                connectWalletBtn.textContent = 'Connect Wallet';
                walletStatus.textContent = 'Wallet not connected';
                eligibilitySection.classList.add('hidden');
            } else if (isConnected) {
                // User switched accounts
                const account = accounts[0];
                connectedAddress.textContent = `${account.slice(0, 6)}...${account.slice(-4)}`;
                checkEligibility(account);
            }
        });
    }
});
