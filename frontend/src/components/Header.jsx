import { useState, useEffect, useRef } from 'react';

import { getImageUrl, delayFor, SERVER_ROOT, format, publicClient } from '../helpers/Utils';

import { useNavigate } from 'react-router-dom';

import { useAppKit, useAppKitAccount, useAppKitEvents, useDisconnect, useAppKitBalance } from "@reown/appkit/react";

import { useProvider } from '../providers/Web3Provider';

import { useSignMessage, useWriteContract } from 'wagmi';

import CryptoJS from 'crypto-js';

import Popup from 'reactjs-popup';

import Modal from './Modal';

import AmountInput from './AmountInput';

import Leaderboard from './Leaderboard';

import VaultABI from '../abis/Vault.json';

import { toast } from 'sonner';
import Socials from './Socials';
import TradingViewTickerTape from './TradingViewTickerTape';

const Header = ({ market = null, data = null, symbols, rewardsDistribution, exchangeRate }) => {

    const navigate = useNavigate();

    const { open } = useAppKit();

    const { fetchBalance } = useAppKitBalance();

    const { disconnect } = useDisconnect();

    const events = useAppKitEvents();

    const { writeContractAsync } = useWriteContract();

    const { isConnected, address } = useAppKitAccount();
    const [wallet, setWallet] = useState();
    const { signMessageAsync } = useSignMessage();

    const { setWeb3Address, web3Address = null, profile, loadProfile, authToken, refCode } = useProvider();

    const [showDeposit, setShowDeposit] = useState(false);

    const [showWithdraw, setShowWithdraw] = useState(false);

    const [showLeaderboard, setShowLeaderboard] = useState(false);

    const [amountWithdraw, setAmountWithdraw] = useState(0);

    const [amountDeposit, setAmountDeposit] = useState(0);

    const [nativeBalance, setNativeBalance] = useState(0);

    const [editUsername, setEditUsername] = useState(false);

    const depositRef = useRef(null);

    const usernameFieldRef = useRef(null);

    const withdrawalRef = useRef(null);

    const [text, setText] = useState('');

    const setUsername = async (close) => {

        const username = text?.trim().replace(/@/ig, '');
        const regex = /^[a-z][a-z0-9_]{2,24}$/;

        if (!username) {
            toast.error(`Username must not be empty!`);
            return false;
        }

        if (regex.test(username)) {

            try {

                const response = await fetch(`${SERVER_ROOT}/auth/${authToken}/username/set`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        username
                    }),
                });

                if (!response.ok) {
                    toast.error('Failed to set username');
                }
                else {

                    const data = await response.json();

                    if (data.status == "success") {
                        await loadProfile();
                        toast.success("Your username has been successfully set!");
                        setEditUsername(false);
                        close();
                    }
                    else {
                        toast.error(data.message);
                    }

                }

            }
            catch (error) {
                console.log(error);
                toast.error('Failed to update username');
            }

        } else {
            toast.error(`Username must be alphanumeric and contain only underscores`);
        }

    };

    useEffect(() => {
        (async () => {
            if (web3Address) {
                loadProfile();
            }
        })();
    }, [web3Address]);

    const enterDepositAmount = (amount) => {
        setAmountDeposit(amount);
        loadProfile();
    }

    const enterWithdrawalAmount = (amount) => {
        setAmountWithdraw(amount);
        loadProfile();
    }

    const withdrawTokens = async () => {

        const amount = parseFloat(amountWithdraw) || 0;

        if (authToken == '') {
            return false;
        }

        if (amount == 0) {
            toast.error('Amount must not be zero!');
            return false;
        }
        if (amount > profile?.balance) {
            toast.error('Amount is greater than available vault balance!');
            return false;
        }

        try {

            const response = await fetch(`${SERVER_ROOT}/trading/${authToken}/withdraw`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount
                }),
            });

            if (!response.ok) {
                toast.error('Failed to withdraw from vault. Please try again!');
            }
            else {

                const data = await response.json();

                if (data.status == "success") {

                    withdrawalRef.current.value = '';
                    const event = new Event("input", { bubbles: true });
                    withdrawalRef.current.dispatchEvent(event);

                    loadProfile();

                    setShowWithdraw(false);

                    toast.success(`Your withdrawal of ${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} BNB from your vault is successful and will be remitted within 15-30 minutes!`);

                }
                else {
                    toast.error(data.message);
                }

            }
        }
        catch (error) {
            console.log(error);
            toast.error("Failed to withdraw from vault. Please try again");
        }

    }

    const depositTokens = async () => {

        const amount = parseFloat(amountDeposit) || 0;

        if (amount == 0) {
            toast.error('Amount must not be zero!');
            return false;
        }
        if (amount > nativeBalance) {
            toast.error('Amount is greater than available wallet balance!');
            return false;
        }

        let hash;

        try {

            hash = await writeContractAsync({
                abi: VaultABI,
                address: import.meta.env.VITE_VAULT_ADDRESS,
                functionName: 'deposit',
                args: [],
                account: web3Address,
                value: (amount * 1e18).toLocaleString("fullwide", { useGrouping: false })
            });

            toast.promise(publicClient.waitForTransactionReceipt({
                hash
            }), {

                loading: 'Deposit in progress...',

                success: async () => {

                    loadBalance();

                    depositRef.current.value = '';
                    const event = new Event("input", { bubbles: true });
                    depositRef.current.dispatchEvent(event);

                    setShowDeposit(false);

                    return `Your deposit of ${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} BNB is complete!`;

                },

                error: (_err) => {
                    console.log(_err);
                    return `Failed to deposit. Please try again`
                }

            });

        }
        catch (error) {
            console.log(error);
            toast.error("Failed to deposit. Please try again");
        }

    }

    const init = async () => {

        if (isConnected === true) {

            const token = localStorage.getItem(address);

            setWallet(address);

            if (token == null) {

                const requestSign = async () => {

                    await delayFor(3000);

                    try {

                        const signature = await signMessageAsync({ message: JSON.stringify({ address }), account: address });

                        localStorage.setItem(address, signature);

                        const response = await fetch(`${SERVER_ROOT}/auth/register${refCode != undefined ? `/${refCode}` : ``}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                address,
                                token: signature
                            }),
                        });

                        if (!response.ok) {
                            requestSign();
                        }
                        else {
                            setWeb3Address(address);
                            if (refCode != null) {
                                navigate("/", { replace: true });
                            }
                        }

                    }
                    catch (error) {
                        requestSign();
                    }

                }
                requestSign();
            }
            else {
                setWeb3Address(address);
            }

        }
    }

    useEffect(() => {
        if (isConnected && address) {
            init();
        }
    }, [isConnected, address]);

    useEffect(() => {
        if (events.data.event == "DISCONNECT_SUCCESS") {
            if (localStorage.getItem(wallet) != null) {
                localStorage.removeItem(wallet);
            }
            setWeb3Address(undefined);
        }
    }, [events]);

    const loadBalance = async () => {
        const balance = await fetchBalance();
        setNativeBalance(parseFloat(parseFloat(balance?.data?.balance).toFixed(6)));
    }

    const deposit = async () => {
        loadProfile();
        await loadBalance();
        setShowDeposit(true);
    }

    const withdraw = async () => {
        await loadProfile();
        setShowWithdraw(true);
    }

    const maxDeposit = () => {
        depositRef.current.value = nativeBalance;
        const event = new Event("input", { bubbles: true });
        depositRef.current.dispatchEvent(event);
    }

    const maxWithdrawal = () => {
        withdrawalRef.current.value = profile?.balance;
        const event = new Event("input", { bubbles: true });
        withdrawalRef.current.dispatchEvent(event);
    }

    const setUsernameText = (value) => {
        setText(value.replace(/@/ig, ''));
    }

    const cancelSetUsername = () => {
        if (profile?.username) {
            setText(profile?.username);
        }
        setEditUsername(false);
    }

    useEffect(() => {
        if (profile?.username) {
            setText(profile?.username);
        }
    }, [profile]);

    return (
        <>

            {showDeposit == true ?
                <Modal title={'Deposit'} sub={'Enjoy 0% fees on BNB deposits into your vault'} close={() => setShowDeposit(false)} width={'500px'}>
                    <div className='p-4'>
                        <div className='d-flex justify-content-between mb-3 px-1'>
                            <span className='text-white'>Amount</span>
                            <span className='balance-text ms-auto'>Balance: {nativeBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} BNB</span>
                        </div>
                        <div className='amount-field'>
                            <AmountInput reference={depositRef} onAmount={enterDepositAmount} />
                            <button className='max-button' onClick={() => maxDeposit()}>MAX</button>
                            <img src={getImageUrl('coin.png')} className={'coin ms-3'} />
                        </div>
                        <div className='mt-4'>
                            <button className='flat-button deposit-alt' onClick={() => depositTokens()}>Deposit Now</button>
                        </div>
                        <div className='d-flex align-items-center justify-content-center my-5 mb-0'>
                            <Socials />
                        </div>
                    </div>
                </Modal> : null
            }

            {showWithdraw == true ?
                <Modal title={'Withdraw'} sub={'Enjoy 0% fees on BNB withdrawals from your vault'} close={() => setShowWithdraw(false)} width={'500px'}>
                    <div className='p-4'>
                        <div className='d-flex justify-content-between mb-3 px-1'>
                            <span className='text-white'>Amount</span>
                            <span className='balance-text ms-auto'>Balance: {profile?.balance.toLocaleString(undefined, { maximumFractionDigits: 6 })} BNB</span>
                        </div>
                        <div className='amount-field'>
                            <AmountInput reference={withdrawalRef} onAmount={enterWithdrawalAmount} />
                            <button className='max-button' onClick={() => maxWithdrawal()}>MAX</button>
                            <img src={getImageUrl('coin.png')} className={'coin ms-3'} />
                        </div>
                        <div className='mt-4'>
                            <button className='flat-button withdraw-alt' onClick={() => withdrawTokens()}>Withdraw</button>
                        </div>
                        <div className='d-flex align-items-center justify-content-center my-5 mb-0'>
                            <Socials />
                        </div>
                    </div>
                </Modal> : null
            }

            {showLeaderboard == true ?
                <Modal title={'Leaderboard'} sub={''} close={() => setShowLeaderboard(false)} width={'950px'}>
                    <Leaderboard market={market} data={data} rewardsDistribution={rewardsDistribution} exchangeRate={exchangeRate} />
                </Modal> : null
            }

            <nav className={`navbar fixed-top navbar-expand-lg px-3`} style={{ zIndex: 5 }}>

                <div className={`my-1 w-100`}>

                    <div className={`d-flex w-100 align-items-center justify-content-between`}>

                        <a style={{ cursor: "pointer" }} className={'navbar-brand d-flex align-items-center '} onClick={() => navigate("/")}>

                            <div className={`logo`}>
                                <img src={getImageUrl('logo.png')} className='logo-img' />
                                <span className='brand ms-2'>MOONRIDE.FUN</span>
                            </div>

                        </a>

                        <div className='d-flex align-items-center justify-content-center ticker-container show-on-desktop'>
                            {symbols?.length > 0 ?
                                <TradingViewTickerTape symbols={symbols} /> : null
                            }
                        </div>

                        <ul className="navbar-nav">

                            {web3Address != undefined ?
                                <>
                                    <li className="nav-item ms-2 me-2 show-on-desktop">
                                        <button type="button" className='flat-button leaderboard w-100' onClick={async () => { loadProfile(); setShowLeaderboard(true) }}>Leaderboard</button>
                                    </li>
                                    <li className="nav-item me-2 show-on-desktop">
                                        <button type="button" className='flat-button deposit w-100' onClick={() => deposit()}>Deposit</button>
                                    </li>

                                    <li className="nav-item me-2 show-on-desktop">
                                        <button type="button" className='flat-button withdraw w-100' onClick={() => withdraw()}>Withdraw</button>
                                    </li>
                                </>
                                : null
                            }

                            <li className="nav-item ms-3">
                                {web3Address == null ?
                                    <button className={`popup-button connect`} onClick={() => open()}>
                                        Connect wallet
                                    </button>
                                    :
                                    <Popup
                                        trigger={<button onClick={() => loadProfile()} className={`popup-button connect`}>
                                            <img src={`https://www.gravatar.com/avatar/${CryptoJS.MD5(`${web3Address}`)}?d=monsterid`} className="avatar me-2" />
                                            {format(web3Address)}
                                            <i className='fas fa-chevron-down ms-2 show-on-mobile-alt'></i>
                                        </button>}
                                        position="bottom center"
                                        nested
                                    >
                                        {(close) => (
                                            <div className='popup py-2'>

                                                <div className='popup-item d-flex align-items-center justify-content-center w-100 my-2'>
                                                    <span>{profile?.balance?.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                                    <img src={getImageUrl('coin.png')} className='coin-small ms-1' />
                                                </div>

                                                {editUsername == true ?
                                                    <div className='row px-0 mx-0'>
                                                        <div className='col-lg-12 px-0 mx-0'>
                                                            <div className='d-flex align-items-end justify-content-center flex-column'>
                                                                <img src={getImageUrl('close-dark.png')} className='username-clear' onClick={() => cancelSetUsername()} />
                                                                <div className='my-2'>
                                                                    <input ref={usernameFieldRef} placeholder='Enter a new username' className='username-field w-100' value={`@${text}`} onInput={(e) => setUsernameText(e.target.value)} />
                                                                </div>
                                                                <button className='flat-button chat w-100' onClick={async () => { await setUsername(close) }}>
                                                                    Set username
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    :
                                                    <div className='popup-item d-flex align-items-center justify-content-center w-100 my-2 mb-3'>
                                                        <b className='profile-username-text'>@{profile?.username}</b>
                                                        <img src={getImageUrl('edit.png')} className='username-clear mx-1' onClick={() => {
                                                            setEditUsername(true); setTimeout(() => {
                                                                usernameFieldRef.current.focus()
                                                            }, 500)
                                                        }} />
                                                        <img src={getImageUrl(profile?.badge?.media)} className='tick ms-2' data-tooltip-id={'global-tooltip'} data-tooltip-content={profile?.badge?.title} />
                                                    </div>
                                                }

                                                <div className='popup-item d-flex align-items-center justify-content-between w-100 my-2 show-on-mobile'>
                                                    <button type="button" className='flat-button leaderboard w-100' onClick={() => { close(); setShowLeaderboard(true) }}>Leaderboard</button>
                                                </div>

                                                <div className='popup-item d-flex align-items-center justify-content-between w-100 my-2 show-on-mobile'>
                                                    <button type="button" className='flat-button deposit w-100' onClick={() => { close(); deposit() }}>Deposit</button>
                                                </div>

                                                <div className='popup-item d-flex align-items-center justify-content-between w-100 my-2 show-on-mobile'>
                                                    <button type="button" className='flat-button withdraw w-100' onClick={() => { close(); withdraw() }}>Withdraw</button>
                                                </div>

                                                <button type="button" className='popup-button disconnect my-2 w-100' onClick={() => { close(); disconnect() }}>Disconnect</button>

                                            </div>
                                        )}

                                    </Popup>
                                }
                            </li>

                        </ul>

                    </div>

                </div>

            </nav>

        </>
    );
};

export default Header;
