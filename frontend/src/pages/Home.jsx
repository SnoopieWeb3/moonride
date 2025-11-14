import React, { useState, useEffect, useRef, useCallback } from 'react';

import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

import Header from '../components/Header';

import { io } from 'socket.io-client';

import { COMMISSION, delayFor, format, formatNumber, getImageUrl, SERVER_ROOT, timeFormat, baseURL } from '../helpers/Utils';
import ChartWindow from '../components/ChartWindow';

import { useProvider } from '../providers/Web3Provider';

import { useAppKit } from "@reown/appkit/react";

import CryptoJS from 'crypto-js';

import { Swiper, SwiperSlide } from 'swiper/react';

import AmountInput from '../components/AmountInput';

import OutcomeModal from '../components/OutcomeModal';
import Outcomes from '../components/Outcomes';

import { CircularProgressbar } from 'react-circular-progressbar';

import Lottie from "lottie-react";

import connectWalletAnimation from "../assets/lottie/connect-wallet.json";
import Socials from '../components/Socials';

import { useParams } from 'react-router-dom';

import Carousel from "react-multi-carousel";
import Info from '../components/Info';
import EmojiTray from '../components/EmojiTray';
import TransactionHistory from '../components/TransactionHistory';
import Network from '../components/Network';

const ChatItem = React.memo(({ value }) => {
    return (
        <div className='chat-item'>
            <div className='chat-index ms-2 my-2'>
                <img loading={'lazy'} src={`https://www.gravatar.com/avatar/${CryptoJS.MD5(`${value.sender.address}`)}?d=monsterid`} className="avatar" />
            </div>
            <div className='chat-content my-2'>
                <div className='d-flex justify-content-between align-items-center mx-2'>
                    <div className='chat-username'>
                        {value.sender.username}
                        <img src={getImageUrl(value.sender.badge.media)} className='tick ms-2' data-tooltip-id={'global-tooltip'} data-tooltip-content={value.sender.badge.title} />
                    </div>
                    <div className='chat-time ms-2'>{timeFormat(value.timestamp)}</div>
                </div>
                {value.message.type == "text" ?
                    <div className='chat-message my-2 mx-2'>{value.message.content}</div>
                    :
                    <div className='chat-message my-2 mx-2'>
                        <img src={getImageUrl(`emojis/${value.message.media}.gif`)} className='emoji-message' />
                    </div>
                }
            </div>
        </div>
    );
});

const OrderItem = React.memo(({ volumes, direction, amount, userDirection, address, username, timestamp }) => {

    let pnl = {
        value: 0,
        percent: 0
    };

    if (direction != 'mid') {

        let winningDirection = direction;
        let losingDirection = direction == 'up' ? 'down' : 'up';
        let winningVolume = volumes[winningDirection] / 1e18;
        let losingVolume = volumes[losingDirection] / 1e18;

        if (userDirection == winningDirection) {
            if (losingVolume > 0) {
                const _wager = losingVolume - (COMMISSION * losingVolume);
                const wager = _wager <= 0 ? 0 : _wager;
                const ratio = (amount / winningVolume) * wager;
                pnl = {
                    value: ratio,
                    percent: (ratio / amount) * 100
                };
            }
        }

    }


    return (<tr>
        <td scope="row">
            <div className='d-flex align-items-center'>
                <img loading={'lazy'} src={`https://www.gravatar.com/avatar/${CryptoJS.MD5(`${address}`)}?d=monsterid`} className="avatar-lg" />
                <div className='d-flex align-items-start flex-column ms-3'>
                    <div className='order-username'>{username}</div>
                    <div className='order-address'>{format(address)}</div>
                </div>
            </div>
        </td>
        <td>
            <div className='order-direction'>
                {userDirection.toUpperCase()}
                <span className='table-mobile-titles ms-2'>ORDER</span>
            </div>
        </td>
        <td>
            <div className='d-flex justify-content-end align-items-center'>
                <img src={getImageUrl('coin.png')} className='coin-small mx-2 ms-3' />
                <span className='text-white'>{amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                <span className='table-mobile-titles ms-2'>AMOUNT</span>
            </div>
        </td>
        <td>
            <span className={`order-pnl ${pnl?.value > 0 ? 'green' : 'red'}`}>
                <div className='px-1'>{pnl?.value > 0 ? '+' : ''}{pnl?.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                <div>({pnl?.value > 0 ? '+' : ''}{pnl?.percent.toLocaleString(undefined, { maximumFractionDigits: 4 })}%)</div>
                <span className='table-mobile-titles ms-2'>POT. PNL</span>
            </span>
        </td>
        <td className='order-time'>
            {timeFormat(timestamp)}
            <span className='table-mobile-titles ms-2'>TIME</span>
        </td>
    </tr>);

});

const Home = () => {

    const navigate = useNavigate();

    const { open } = useAppKit();

    const { web3Address = null, authToken, loadProfile, profile, socketRef, setSocketRef, socketChanged, setRefCode } = useProvider();

    const chatInputRef = useRef(null);

    const [market, setMarket] = useState('btc');

    const defaultCharts = { prices: [], timestamps: [] };

    const [outcomes, setOutcomes] = useState([]);

    const [online, setOnline] = useState(0);

    const [symbols, setSymbols] = useState([]);

    const [marketState, setMarketState] = useState(0);

    const [chartData, setChartData] = useState(defaultCharts);

    const [marketDirection, setMarketDirection] = useState(null);

    const [tradeAmount, setTradeAmount] = useState(0);

    const amountRef = useRef(null);

    const chatWindowRef = useRef(null);

    const chatsRef = useRef({});

    const [text, setText] = useState('');

    const [chats, setChats] = useState({});

    const [participants, setParticipants] = useState({ up: 0, down: 0 });

    const [volumes, setVolumes] = useState({ up: 0, down: 0 });

    const [inMarket, setInMarket] = useState(false);

    const [lastUserEntry, setLastUserEntry] = useState({});

    const lastUserEntryRef = useRef(lastUserEntry);

    const [orders, setOrders] = useState([]);

    const [resultModal, setResultModal] = useState(false);

    const [resultData, setResultData] = useState({ user: null, system: null });

    const [leaderboardData, setLeaderboardData] = useState({});

    const [sentiments, setSentiments] = useState({ bullish: { value: 50, width: 50 }, bearish: { value: 50, width: 50 } });

    const [exchangeRate, setExchangeRate] = useState(0);

    const [rewardsDistribution, setRewardsDistribution] = useState([]);

    const [marketPosition, setMarketPosition] = useState({
        direction: null,
        pnl: {
            value: 0,
            percent: 0
        },
        stake: 0
    });

    const [loading, setLoading] = useState(true);

    const [loaderPercent, setLoaderPercent] = useState(0);

    const [queryToggle, setQueryToggle] = useState(false);

    const [round, setRound] = useState('--');

    const { ref, refUsername } = useParams();

    const [betType, setBetType] = useState(0);

    const autoBetRef = useRef(null);

    const [autoBet, setAutoBet] = useState({});

    const [ads, setAds] = useState([]);

    const [isPercent, setIsPercent] = useState(false);

    const [emojis, setEmojis] = useState([]);

    const [showChatWindow, setShowChatWindow] = useState(true);

    const responsive = {
        all: {
            breakpoint: { max: 3000, min: 0 },
            items: 1,
            slidesToSlide: 1
        }
    };

    const chatScreenRef = useRef(null);

    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    const onMessage = useCallback(async (message) => {

        let _chats = { ...chatsRef.current };

        _chats[message.market.toLowerCase()].push(message);

        chatsRef.current = _chats;

        setChats(_chats);

    }, [market, web3Address, chats]);

    const sendChat = () => {
        if (text.trim() != "") {
            const message = text.trim();
            socketRef.current.emit('message', { market, message, type: "text" });
            setText('');
            chatInputRef.current.blur();
        }
        else {
            setText('');
        }
    }

    const sendEmoji = (emoji) => {
        socketRef.current.emit('message', { market, message: emoji, type: "emoji" });
        chatInputRef.current.focus();
    }

    const vote = (index) => {
        socketRef.current.emit('vote', index);
    }

    const onData = useCallback((data) => {

        const bullish = data.bullishCount;
        const bearish = data.bearishCount;

        setEmojis(data.emojis);

        setExchangeRate(data.exchangeRate);
        setRewardsDistribution(data.rewardsDistribution);

        const total = bullish + bearish;

        if (bullish != null && bearish != null) {
            setSentiments({
                bullish: {
                    width: bullish > 0 && bearish == 0 ? 100 : (bullish / total) * 100,
                    value: (bullish / total) * 100
                },
                bearish: {
                    width: bearish > 0 && bullish == 0 ? 100 : (bearish / total) * 100,
                    value: (bearish / total) * 100
                }
            });
        }

        setLeaderboardData(data.leaderboard);

        const prices = [];

        const timestamps = [];

        if (data.roundStatus == 0) {

            setChartData({
                prices: [],
                timestamps: [],
                direction: 'MID'
            });

            setMarketState(0);

        }
        else {

            for (let item of data.pricing) {
                prices.push(item.price);
                timestamps.push(item.timestamp);
            }
            setChartData({
                prices,
                timestamps,
                direction: data.direction
            });
            setMarketDirection(data.direction);
            setMarketState(1);

        }

        setOutcomes(data.history);
        setSymbols(data.symbols);
        setOnline(data.online);

        if (autoBetRef.current == null) {
            autoBetRef.current = {};
            for (let symbol of data.symbols) {
                autoBetRef.current[symbol] = { enabled: false, configuration: {} };
            }
            setAutoBet(autoBetRef.current);
        }

        setParticipants({
            up: data.up.participants,
            down: data.down.participants
        });

        setVolumes({
            up: data.up.volume,
            down: data.down.volume
        });

        if (data.roundStatus == 0) {
            setLoaderPercent((data.counter / 30) * 100);
        }
        else {
            const difference = 60 - data.counter;
            const percent = (difference / 30) * 100;
            setLoaderPercent(percent);
        }

        if (data.counter == 0) {
            setInMarket(false);
            setOrders([]);
            queryEntryStatus(data.ticker);
            fetchOrders(data.ticker);
        }

        if (data.roundStatus == 0) {
            setRound('--');
        }
        else {
            setRound(data.round);
        }

    }, [web3Address, market]);

    const fetchOrders = async (_market) => {
        const marketSymbol = _market.toUpperCase();
        const response = await fetch(`${SERVER_ROOT}/trading/orders/${marketSymbol}/get`, { method: 'GET' });
        if (response.ok) {
            const data = await response.json();
            if (data.status == "success") {
                setOrders(data.orders);
            }
        }
        else {
            setOrders([]);
        }
    }

    const onResolved = useCallback(async (data) => {
        loadProfile();
        if (lastUserEntryRef.current.hasOwnProperty(market)) {
            setResultData({ user: lastUserEntryRef.current, system: data });
            setResultModal(true);
            setLastUserEntry({});
        }
    }, [web3Address, market]);

    useEffect(() => {
        lastUserEntryRef.current = lastUserEntry;
    }, [lastUserEntry]);

    const onTrade = useCallback((data) => {

        fetchOrders(data.market);

        if (data.address == web3Address) {
            if (data.fromDirect == false) {
                toast.success(`Your Auto-staker just filed '${data.direction.toUpperCase()}' with ${data.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} BNB on this market!`);
                return false;
            }
            else {
                return false;
            }
        }

        toast.custom(() => (
            <div className='trade-alert'>
                <img loading={'lazy'} src={`https://www.gravatar.com/avatar/${CryptoJS.MD5(`${data.address}`)}?d=monsterid`} className="avatar-lg me-1" />
                <div className='trade-alert-body'>
                    <div className='chat-username mx-2'>
                        {data.username}
                        <img src={getImageUrl(data.badge.media)} className='tick ms-2' data-tooltip-id={'global-tooltip'} data-tooltip-content={data.badge.title} />
                    </div>
                    <div className='d-flex justify-content-start align-items-center mx-2 py-1'>
                        <div className={`rounds-sm ${data.direction} me-3`}>
                            <div className='round-state'>{data.direction == 'down' ? '↘' : '↗'} {data.direction.toUpperCase()}</div>
                        </div>
                        <div className='trade-alert-amount'>
                            <img src={getImageUrl('coin.png')} className='coin-small mx-2 ms-3' />
                            <span className='text-white'>{data.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                        </div>
                    </div>
                </div>
            </div>
        ), {
            position: 'bottom-right',
            duration: 2500
        });

    }, [web3Address, market]);

    useEffect(() => {
        if (socketChanged == true) {
            // socket changed
        }
    }, [socketChanged]);

    const enterAmount = (amount) => {
        setTradeAmount(amount);
        loadProfile();
    }

    const amountEntry = async (index) => {

        loadProfile();

        const balance = profile.balance;
        const amount = parseFloat(tradeAmount) || 0;
        const event = new Event("input", { bubbles: true });

        if (index == 0) {
            amountRef.current.value = (amount + 0.001).toLocaleString('fullwide', { useGrouping: false });
        }
        else if (index == 1) {
            amountRef.current.value = (amount + 0.01).toLocaleString('fullwide', { useGrouping: false });
        }
        else if (index == 2) {
            amountRef.current.value = (amount + 0.1).toLocaleString('fullwide', { useGrouping: false });
        }
        else if (index == 3) {
            amountRef.current.value = (amount + 1).toLocaleString('fullwide', { useGrouping: false });
        }
        else if (index == 4) {
            amountRef.current.value = (amount / 2).toLocaleString('fullwide', { useGrouping: false });
        }
        else if (index == 5) {
            amountRef.current.value = parseFloat(balance.toFixed(6));
        }

        amountRef.current.dispatchEvent(event);

    }

    const link = (_market) => {
        try {
            if (socketRef.current) {
                socketRef.current?.off('data', onData);
                socketRef.current?.off('message', onMessage);
                socketRef.current?.off('resolved', onResolved);
                socketRef.current?.off('trade', onTrade);
                socketRef.current?.disconnect();
            }
        }
        catch (error) { }
        const socket = io(`${SERVER_ROOT}/${_market}`, {
            auth: {
                token: authToken
            },
            transports: ["websocket"],
            reconnection: true
        });
        setSocketRef(socket);
        socketRef.current?.on('data', onData);
        socketRef.current?.on('resolved', onResolved);
        socketRef.current?.on('trade', onTrade);
        socketRef.current?.on('message', onMessage);
    }

    useEffect(() => {

        if (ref === 'ref') {
            if (refUsername?.trim() != '') {
                setRefCode(refUsername);
            }
        }

        if (web3Address == null) {
            return () => {

            };
        }
        else {

            if (market) {
                link(market);
            }

            return () => {
                socketRef.current?.off('data', onData);
                socketRef.current?.off('message', onMessage);
                socketRef.current?.off('trade', onTrade);
                socketRef.current?.off('resolved', onResolved);
                socketRef.current?.disconnect();
            };

        }

    }, [onData, web3Address, authToken]);

    const pickMarket = async (_market) => {
        setMarket(_market);
        link(_market);
        setOrders([]);
        fetchOrders(_market);
        queryEntryStatus(_market);
        setBetType(0);
    }

    useEffect(() => {
        const el = chatWindowRef.current;
        if (!el) return;
        const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
        if (distanceFromBottom < (window.innerHeight / 3)) {
            el.scrollTop = el.scrollHeight;
        }
    }, [market, chats]);

    useEffect(() => {

        let _chats = { ...chatsRef.current };

        for (let symbol of symbols) {
            if (!_chats.hasOwnProperty(symbol?.toLowerCase())) {
                _chats[symbol?.toLowerCase()] = [];
                chatsRef.current = _chats;
            }
        }

    }, [symbols]);

    useEffect(() => {
        if (marketState == 0) {
            if (authToken != '0') {
                setLoading(true);
                queryEntryStatus(market);
            }
        }
    }, [marketState]);

    useEffect(() => {
        if (authToken != '0') {
            queryEntryStatus(market);
        }
    }, [marketDirection]);

    const queryEntryStatus = async (_market) => {
        const response = await fetch(`${SERVER_ROOT}/trading/${authToken}/entry/${_market}/get`, { method: 'GET' });
        let _lastUserEntry;
        if (response.ok) {
            const data = await response.json();
            if (data.status == "success") {
                setInMarket(data.entry.inMarket);
                setLoading(false);
                if (data.entry.inMarket == true) {
                    _lastUserEntry = { ...lastUserEntry };
                    _lastUserEntry[_market] = { direction: data.entry.direction, stake: data.entry.stake, round };
                    setLastUserEntry(_lastUserEntry);
                }
                delete data.entry.inMarket;
                setMarketPosition(data.entry);
                setAutoBet(data.autoStake);
            }
        }
    }

    useEffect(() => {
        (async () => {
            if (authToken != '0') {
                const response = await fetch(`${SERVER_ROOT}/auth/${authToken}/ads/get`, { method: 'GET' });
                if (response.ok) {
                    const data = await response.json();
                    if (data.status == "success") {
                        setAds(data.ads);
                    }
                }
            }

        })();
    }, [authToken]);

    useEffect(() => {
        (async () => {
            if (authToken != '0') {
                try {
                    await queryEntryStatus(market);
                    await fetchOrders(market);
                }
                catch (error) { }
            }
            await delayFor(3500);
            setQueryToggle(!queryToggle);
        })();
    }, [queryToggle]);


    const cancelAuto = async () => {

        try {

            const response = await fetch(`${SERVER_ROOT}/trading/${authToken}/auto/stake/${market}/cancel`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                toast.error('Failed to cancel Auto-Stake. Please try again!');
            }
            else {

                const data = await response.json();

                if (data.status == "success") {
                    queryEntryStatus(market);
                    toast.success(`Auto-Stake has been disabled on your account`);
                }
                else {
                    toast.error(data.message);
                }

            }

        }
        catch (error) {
            console.log(error);
            toast.error('Failed to cancel Auto-Stake');
        }

    }

    const placeOrder = async (orderDirection) => {

        try {

            const amount = parseFloat(tradeAmount) || 0;

            const response = await fetch(`${SERVER_ROOT}/trading/${authToken}/order/${market}/${orderDirection}/${betType == 0 ? 'single' : 'auto'}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    amount,
                    amountType: isPercent == true ? 'percent' : 'fixed'
                }),
            });

            if (!response.ok) {
                toast.error('Failed to place order. Please try again!');
            }
            else {

                const data = await response.json();

                if (data.status == "success") {

                    const event = new Event("input", { bubbles: true });

                    if (amountRef.current) {
                        amountRef.current.value = '';
                        amountRef.current.dispatchEvent(event);
                    }

                    if (betType == 0) {
                        toast.success(`Your Bet for ${orderDirection.toUpperCase()} [${market.toUpperCase()}] has been placed with ${amount.toLocaleString(undefined, { maximumFractionDigits: 6 })} $BNB!`);
                    }
                    else {
                        toast.success(`Auto-Stake has been enabled on your account for ${orderDirection.toUpperCase()} on [${market.toUpperCase()}]!`);
                    }

                    await Promise.all([queryEntryStatus(market), fetchOrders(market)]);

                }
                else {
                    toast.error(data.message);
                }
            }

        }
        catch (error) {
            console.log(error);
            toast.error('Failed to place order. Please try again!');
        }
    }

    const clickAd = async (url) => {
        if (url.includes("action::")) {
            const action = url.split('action::')[1];
            if (action == "referrals") {
                navigator.clipboard.writeText(`${baseURL()}/ref/${profile?.username}`).then(() => {
                    toast.success("Your referral link has been copied to clipboard!");
                });
            }
        }
        else {
            open(url);
        }
    }

    const isFirstMobile = useRef(false);
    const isFirstDesktop = useRef(false);

    const handleResize = useCallback(() => {

        if (window.innerWidth <= 900) {
            isFirstDesktop.current = false;
            if (isFirstMobile.current == false) {
                setShowChatWindow(false);
                chatScreenRef.current.classList.remove("show");
                chatScreenRef.current.classList.add("mobile-chat-hide");
                chatScreenRef.current.classList.remove("mobile-chat-show");
                isFirstMobile.current = true;
            }
        }
        else {
            isFirstMobile.current = false;
            if (isFirstDesktop.current == false) {
                setShowChatWindow(true);
                chatScreenRef.current.classList.add("show");
                chatScreenRef.current.classList.remove("mobile-chat-show");
                chatScreenRef.current.classList.add("mobile-chat-hide");
                isFirstDesktop.current = true;
            }
        }

        setWindowSize({
            height: window.innerHeight,
            width: window.innerWidth
        });

    }, []);

    const toggleChatWindow = async () => {
        const chatWindowState = !showChatWindow;
        if (windowSize.width <= 900) {
            if (chatWindowState == false) {
                chatScreenRef.current.classList.remove("mobile-chat-show");
                chatScreenRef.current.classList.add("mobile-chat-hide");
            }
            else {
                chatScreenRef.current.classList.remove("mobile-chat-hide");
                chatScreenRef.current.classList.add("mobile-chat-show");
            }
        }
        setShowChatWindow(chatWindowState);
    }

    useEffect(() => {

        if (web3Address != null) {

            window.addEventListener("resize", handleResize);

            handleResize();

            return () => window.removeEventListener("resize", handleResize);

        }

    }, [web3Address]);


    return (

        <div className={`main-content dark-bg`}>

            <Header market={market} data={leaderboardData} symbols={symbols} exchangeRate={exchangeRate} rewardsDistribution={rewardsDistribution} />

            {web3Address === null ?
                <div className='connect-wallet-main px-4'>
                    <div className='connect-wallet-title'>Connect your wallet</div>
                    <div className='connect-wallet-sub-title my-2'>Connect your wallet to dive into the Degenverse!</div>
                    <Lottie
                        animationData={connectWalletAnimation}
                        loop={true}
                        autoplay={true}
                        className={`connect-wallet-animation my-3`}
                    />
                    <div className='py-4 row pb-0'>
                        <center>
                            <button className='popup-button connect-wallet' onClick={() => open()}>Take me in!</button>
                        </center>
                    </div>
                </div>
                :
                <>
                    {resultModal == true ?
                        <OutcomeModal close={() => setResultModal(false)} width={'400px'}>
                            <Outcomes data={resultData} market={market} />
                        </OutcomeModal> : null
                    }

                    <div className="row justify-content-center mx-0 px-0 flex-row">

                        <div className="col-xl-9 bordered-section order-lg-2 px-0 mx-0 flex-grow main-action-area">

                            <div className='chat-toggle' onClick={() => toggleChatWindow()}>
                                <div className='show-on-desktop'>
                                    {showChatWindow == true ?
                                        <img src={getImageUrl('arrow-left.png')} className='arrow' />
                                        :
                                        <img src={getImageUrl('arrow-right.png')} className='arrow' />
                                    }
                                </div>
                                <div className='show-on-mobile'>
                                    <img src={getImageUrl('chat-toggle-icon.png')} className='chat-toggle-icon' />
                                </div>
                            </div>

                            <div className='row mt-4 mt-lg-2 align-items-center'>
                                <div className='col-md-5 align-items-center px-4 py-2'>
                                    <div className='mx-3'>
                                        <div className='text-white'>Choose market</div>
                                        <Swiper
                                            className='mt-2 py-2 market-swiper'
                                            spaceBetween={15}
                                            loop={false}
                                            slidesPerView="auto"
                                            freeMode={true}
                                        >
                                            {symbols.map((value, index) => {
                                                return <SwiperSlide key={index} className={`popup-button ${market == value?.toLowerCase() ? value.toLowerCase() : ''} me-2`} onClick={() => pickMarket(value.toLowerCase())}>
                                                    {value}
                                                </SwiperSlide>
                                            })}
                                        </Swiper>
                                    </div>
                                </div>
                                <div className='col-md-7 py-3 mobile-horizontal-margin px-4 px-lg-0 mx-0'>

                                    <div className='light-text d-flex align-items-center justify-content-end'>

                                        <span className='me-auto'>Last 30 draws
                                            <Info text={`The most recent ${market?.toUpperCase()} outcomes for the last 30 rounds from right to left`} />
                                        </span>

                                        <TransactionHistory />

                                        <img src={getImageUrl('stream.png')} className='mx-3 stream-icon' data-tooltip-id={'global-tooltip'} data-tooltip-content={`Live streams are coming`}/>

                                        <Network />
                                        
                                    </div>

                                    <Swiper
                                        className='py-2 round-swiper'
                                        spaceBetween={10}
                                        slidesPerView={'auto'}
                                        loop={false}
                                        freeMode={true}
                                    >
                                        {outcomes.map((value, index) => {
                                            return <SwiperSlide key={index} className={`rounds ${value?.toLowerCase()}`}>
                                                <div className='round-state'>{value == 'DOWN' ? '↘' : '↗'} {value}</div>
                                            </SwiperSlide>
                                        })}
                                    </Swiper>

                                </div>
                            </div>

                            <div className='px-4'>

                                <div className='row'>

                                    <div className='col-xl-9 order-1 order-xl-1'>

                                        <div className={`card-container dark-bg mt-3`}>

                                            <ChartWindow data={chartData} />

                                            {marketState == 0 ?
                                                <div className='waiting ps-4'>
                                                    <div className='waiting-title'>Waiting for next round</div>
                                                    <div className='waiting-sub'>Lock in with your 💰</div>
                                                    <div className='loading-container m-3'>
                                                        <div className='loading-bar' style={{ width: `${loaderPercent}%` }}></div>
                                                    </div>
                                                </div> : null
                                            }
                                            <div className='row d-flex align-items-center justify-content-center'>

                                                <div className='col-md-auto mx-2'>
                                                    <center>
                                                        <span className='credits my-2'>Powered by <img src={getImageUrl('binance.png')} className='credits-logo mx-2' /> Binance</span>
                                                    </center>
                                                </div>

                                                <div className='col-md-auto'>
                                                    <div className='d-flex align-items-center justify-content-center'>
                                                        
                                                        <div className='chat-index ms-2 my-2 text-bold'>
                                                            <span className='px-3'># {round}</span>
                                                        </div>
                                                        {marketState == 1 ?
                                                            <div className='circular-progress mx-5'>
                                                                <CircularProgressbar
                                                                    value={loaderPercent}
                                                                    text={Math.ceil((loaderPercent / 100) * 30)}
                                                                    background={false}
                                                                    styles={{
                                                                        text: {
                                                                            fill: '#FFFFFF',
                                                                            fontSize: '40px',
                                                                            fontFamily: '"Avenue Mono", sans-serif',
                                                                            fontWeight: 'bold'
                                                                        },
                                                                        trail: {
                                                                            stroke: `#f2f2f2`
                                                                        },
                                                                        path: {
                                                                            stroke: `#5F5EAD`,
                                                                            strokeLinecap: 'round'
                                                                        },
                                                                        background: {
                                                                            fill: 'transparent'
                                                                        }
                                                                    }}
                                                                />
                                                            </div> : null
                                                        }

                                                    </div>

                                                </div>
                                            </div>

                                        </div>

                                    </div>

                                    <div className='col-xl-3 px-0 order-3 order-xl-2'>

                                        <div className='my-xl-0 my-4 mb-0 mt-0 row justify-content-center align-items-center'>

                                            <div className='row my-2 mt-0 align-items-center px-3'>

                                                <div className='text-white market-index-title my-4 mb-3'>
                                                    Market Index ({market?.toUpperCase()}) <Info text={`A reflection of the opinion of players towards the condition of the ${market?.toUpperCase()} market this round`}></Info>
                                                </div>

                                                <div className="slanted-bar-container">

                                                    {sentiments.bullish != 0 ?
                                                        <div className="bar-section green" style={{ width: `${sentiments.bullish.width}%` }}>
                                                            <img src={getImageUrl('bullish.png')} className='sentiments me-2' />
                                                            <span>{sentiments.bullish.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
                                                        </div> : null
                                                    }

                                                    {sentiments.bearish != 0 ?
                                                        <div className="bar-section red" style={{ width: `${sentiments.bearish.width}%` }}>
                                                            <span>{sentiments.bearish.value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</span>
                                                            <img src={getImageUrl('bearish.png')} className='sentiments ms-2' />
                                                        </div> : null
                                                    }

                                                </div>

                                                <div className='row'>

                                                    <div className='sentiment-text px-3 my-3'>
                                                        What do you think about the market this round?
                                                    </div>

                                                </div>

                                                <div className='row justify-content-center my-2 align-items-center px-0 mx-0'>

                                                    <div className='col-sm-6 py-2'>
                                                        <button className='popup-button bullish' onClick={() => vote(1)}>
                                                            <img src={getImageUrl('bullish-alt.png')} className='sentiments-alt me-2' />
                                                            <span>Bullish</span>
                                                        </button>
                                                    </div>

                                                    <div className='col-sm-6 py-2'>
                                                        <button className='popup-button bearish' onClick={() => vote(0)}>
                                                            <img src={getImageUrl('bearish-alt.png')} className='sentiments-alt me-2' />
                                                            <span>Bearish</span>
                                                        </button>
                                                    </div>

                                                </div>
                                            </div>

                                        </div>

                                        <div className='px-3'>

                                            <div className='text-white market-index-title mt-4 mb-2'>
                                                Total Value Staked <Info text={`Total amount staked by all users on 'UP' and 'DOWN' into the ${market?.toUpperCase()} pool`}></Info>
                                            </div>

                                            <div className='entry-cards-alt row justify-content-between my-3 mx-0'>
                                                <div className='entry-title col-md-6 my-1'>UP</div>
                                                <div className='col-md-auto my-1 d-flex align-items-center'>
                                                    <img src={getImageUrl('coin.png')} className='coin-small me-2' />
                                                    <span className='text-white-lg'>
                                                        {formatNumber(volumes.up / 1e18)}
                                                    </span>
                                                    <span className='usd-value-alt ms-2'>
                                                        ~ ${formatNumber((volumes.up / 1e18) * exchangeRate)}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className='entry-cards-alt row justify-content-between my-3 mx-0'>
                                                <div className='entry-title col-md-6 my-1'>DOWN</div>
                                                <div className='col-md-auto my-1 d-flex align-items-center'>
                                                    <img src={getImageUrl('coin.png')} className='coin-small me-2' />
                                                    <span className='text-white-lg'>
                                                        {formatNumber(volumes.down / 1e18)}
                                                    </span>
                                                    <span className='usd-value-alt ms-2'>
                                                        ~ ${formatNumber((volumes.down / 1e18) * exchangeRate)}
                                                    </span>
                                                </div>
                                            </div>

                                        </div>

                                    </div>

                                    <div className='col-xl-9 order-2 order-xl-3'>

                                        {web3Address == null ?
                                            <>
                                                <div className='row px-5 justify-content-center py-5 pb-0'>
                                                    <div className='col-md-12'>
                                                        <center>
                                                            <span className='light-text justify-content-center'>Connect your wallet to trade!</span>
                                                        </center>
                                                    </div>
                                                </div>
                                            </>
                                            :
                                            <>
                                                {marketState == 0 && inMarket == false && loading == false ?

                                                    <div className='trading-area'>

                                                        <div className='row pt-5 pb-0'>
                                                            <div className='col-lg-12 px-2'>
                                                                <center>
                                                                    <div className='sub-title'>Place your bet!</div>
                                                                </center>
                                                            </div>
                                                        </div>

                                                        <div className='row px-2 justify-content-center'>

                                                            <div className='col-md-10 px-0'>

                                                                <div className={`card-container pt-4 dark-bg mt-4`}>

                                                                    {autoBet?.[market.toUpperCase()]?.enabled == true ?

                                                                        <div className='row align-items-center justify-content-center py-2'>

                                                                            <center>

                                                                                <span className='text-light wait-entry my-2'>Auto-Stake is Enabled <img src={getImageUrl('bot-click.png')} className='send-icon mx-2' /></span>

                                                                                <div className='my-3'>

                                                                                    <div className='entry-amount-alt d-flex align-items-center justify-content-center'>
                                                                                        <span className='col-md-auto my-1'>
                                                                                            <center>
                                                                                                <img src={getImageUrl('coin.png')} className='coin-small mx-2' />
                                                                                                <span className='col-md-auto mx-2 my-1 text-white'>
                                                                                                    {autoBet?.[market.toUpperCase()]?.configuration?.amount.toLocaleString()}{autoBet?.[market.toUpperCase()]?.configuration?.type == 'percent' ? '%' : ''}
                                                                                                </span>
                                                                                            </center>
                                                                                        </span>
                                                                                        <span className='mx-2'>
                                                                                            <div className={`rounds ${autoBet?.[market.toUpperCase()]?.configuration?.direction}`}>
                                                                                                <div className='round-state'>{autoBet?.[market.toUpperCase()]?.configuration?.direction == 'down' ? '↘' : '↗'} {autoBet?.[market.toUpperCase()]?.configuration?.direction?.toUpperCase()}</div>
                                                                                            </div>
                                                                                        </span>
                                                                                    </div>

                                                                                </div>

                                                                                <div className='my-3'>
                                                                                    <button className='cancel-auto-stake' onClick={() => cancelAuto()}>
                                                                                        <img src={getImageUrl('close.png')} className='cancel-close me-1' />
                                                                                        <span>Disable Auto-Stake</span>
                                                                                    </button>
                                                                                </div>

                                                                                <div className='my-2 mb-0 d-flex align-items-center justify-content-center px-5'>
                                                                                    {profile?.balance < autoBet?.[market.toUpperCase()]?.configuration?.amount && profile?.balance < autoBet?.[market.toUpperCase()]?.configuration?.type == 'fixed' ?
                                                                                        <span className='text-error'>
                                                                                            <i className='fas fa-exclamation-circle me-2'></i>
                                                                                            Your balance is insufficient for auto-staking with {autoBet?.[market.toUpperCase()]?.configuration?.amount.toLocaleString()} BNB.
                                                                                            <br />Kindly deposit more tokens into your vault!
                                                                                        </span>
                                                                                        :
                                                                                        null
                                                                                    }
                                                                                </div>

                                                                            </center>

                                                                        </div>
                                                                        :
                                                                        <>
                                                                            {/*
                                                                            <center>
                                                                                <div className='row my-3 align-items-center justify-content-center px-5'>
                                                                                    <div className='choose-bet-type'>
                                                                                        <Swiper
                                                                                            slidesPerView={'auto'}
                                                                                            spaceBetween={5}
                                                                                            loop={false}
                                                                                            freeMode={true}
                                                                                        >
                                                                                            <SwiperSlide onClick={() => { setIsPercent(false); setBetType(0) }} className={`bet-type ${betType == 0 ? 'active' : ''}`}>
                                                                                                <img src={getImageUrl('human-click.png')} className='clicks me-2' />
                                                                                                <span>One-Time</span>
                                                                                            </SwiperSlide>
                                                                                            <SwiperSlide onClick={() => { setIsPercent(false); setBetType(1) }} className={`bet-type ${betType == 1 ? 'active' : ''}`}>
                                                                                                <img src={getImageUrl('bot-click.png')} className='clicks me-2' />
                                                                                                <span>Auto-Stake</span>
                                                                                            </SwiperSlide>
                                                                                        </Swiper>
                                                                                    </div>
                                                                                </div>
                                                                            </center>
                                                                            */}

                                                                            <div className='row d-flex justify-content-center align-items-center'>
                                                                                <div className='col-md-auto my-3 mobile-no-margin d-flex align-items-center justify-content-center'>
                                                                                    <div className='d-flex align-items-center justify-content-between amount-area'>
                                                                                        <AmountInput isPercent={isPercent} reference={amountRef} onAmount={enterAmount} />
                                                                                        <img src={getImageUrl('coin.png')} className={'coin ms-2'} />
                                                                                    </div>
                                                                                </div>

                                                                                <div className='col-md-auto my-3 d-flex align-items-center justify-content-center'>
                                                                                    <Swiper
                                                                                        slidesPerView={'auto'}
                                                                                        spaceBetween={10}
                                                                                        loop={false}
                                                                                        freeMode={true}
                                                                                    >
                                                                                        <SwiperSlide className='flat-button stake-controls' onClick={() => amountEntry(0)}>+{(0.001).toLocaleString()}</SwiperSlide>
                                                                                        <SwiperSlide className='flat-button stake-controls' onClick={() => amountEntry(1)}>+{(0.01).toLocaleString()}</SwiperSlide>
                                                                                        <SwiperSlide className='flat-button stake-controls' onClick={() => amountEntry(2)}>+{(0.1).toLocaleString()}</SwiperSlide>
                                                                                        <SwiperSlide className='flat-button stake-controls' onClick={() => amountEntry(3)}>+1</SwiperSlide>
                                                                                        <SwiperSlide className='flat-button stake-controls' onClick={() => amountEntry(4)}>1/2</SwiperSlide>
                                                                                        <SwiperSlide className='flat-button stake-controls' onClick={() => amountEntry(5)}>MAX</SwiperSlide>
                                                                                    </Swiper>
                                                                                </div>

                                                                            </div>

                                                                            <div className='d-flex py-2 justify-content-center align-items-center px-5'>

                                                                                {betType == 1 ?
                                                                                    <center>
                                                                                        <span className='bet-type-hint'>
                                                                                            <i className='fas fa-info-circle me-2'></i>
                                                                                            Bets perpetually on either 'UP' or 'DOWN' on every round until you disable it. Cancel anytime!
                                                                                        </span>
                                                                                    </center>
                                                                                    :
                                                                                    <center>
                                                                                        <span className='bet-type-hint'>
                                                                                            <i className='fas fa-info-circle me-2'></i>
                                                                                            Swift, one-time bet. Fast! Great for inclusive staking.
                                                                                        </span>
                                                                                    </center>
                                                                                }

                                                                            </div>

                                                                            {betType == 1 ?
                                                                                <div className='my-3'>
                                                                                    <div className='d-flex align-items-center justify-content-center'>
                                                                                        <input type={'checkbox'} checked={isPercent} className='me-2 percent-check' onChange={(e) => setIsPercent(e.target.checked)} />
                                                                                        <span className='percent-use'>Use as percentage value</span>
                                                                                        <Info text='If checked, the input amount will be applied as a percentage value; otherwise, it will be treated as a fixed amount.' />
                                                                                    </div>
                                                                                </div>
                                                                                : null
                                                                            }

                                                                            <div className='d-flex py-3 pt-0 justify-content-center align-items-center mb-2'>
                                                                                <div className='d-flex align-items-center justify-content-center flex-column'>
                                                                                    <div className='my-3'>
                                                                                        <span className='light-text text-sm'>
                                                                                            <img src={getImageUrl('users.png')} className='users me-2' /> {participants.up.toLocaleString()}
                                                                                        </span>
                                                                                    </div>
                                                                                    <button className='popup-button up mx-2' onClick={() => placeOrder('up')}>
                                                                                        {betType == 0 ?
                                                                                            <img src={getImageUrl('human-click.png')} className='clicks me-2' /> :
                                                                                            <img src={getImageUrl('bot-click.png')} className='clicks me-2' />
                                                                                        }
                                                                                        <span>UP</span>
                                                                                    </button>
                                                                                </div>
                                                                                <div className='d-flex align-items-center justify-content-center flex-column'>
                                                                                    <div className='my-3'>
                                                                                        <span className='light-text text-sm'>
                                                                                            <img src={getImageUrl('users.png')} className='users me-2' /> {participants.down.toLocaleString()}
                                                                                        </span>
                                                                                    </div>
                                                                                    <button className='popup-button down mx-2' onClick={() => placeOrder('down')}>
                                                                                        {betType == 0 ?
                                                                                            <img src={getImageUrl('human-click.png')} className='clicks me-2' /> :
                                                                                            <img src={getImageUrl('bot-click.png')} className='clicks me-2' />
                                                                                        }
                                                                                        <span>DOWN</span>
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                        </>
                                                                    }

                                                                </div>

                                                            </div>

                                                        </div>

                                                    </div> : null

                                                }

                                                {inMarket == true && loading == false ?
                                                    <>
                                                        <div className='row py-3 pt-5 pb-0'>
                                                            <div className='col-lg-12 px-4 pb-2'>
                                                                <center>
                                                                    <div className='sub-title'>Your Position</div>
                                                                </center>
                                                            </div>
                                                        </div>

                                                        <div className='row justify-content-center px-5 py-2 pt-0 mb-0'>
                                                            <div className='col-lg-4 px-4 py-2'>
                                                                <div className='entry-cards'>
                                                                    <div className='entry-title'>Order</div>
                                                                    <div className='entry-direction'>{marketPosition.direction.toUpperCase()}</div>
                                                                </div>
                                                            </div>
                                                            <div className='col-lg-4 px-4 py-2'>
                                                                <div className='entry-cards'>
                                                                    <div className='entry-title'>Stake</div>
                                                                    <div className='entry-amount'>
                                                                        <img src={getImageUrl('coin.png')} className='coin-small mx-2' />
                                                                        <span className='text-white'>{marketPosition.stake.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className='col-lg-4 px-4 py-2'>
                                                                <div className='entry-cards'>
                                                                    <div className='entry-title'>Pot. PnL</div>
                                                                    <span className={`entry-pnl ${marketPosition.pnl?.value > 0 ? 'green' : 'red'}`}>
                                                                        <div className='px-1'>{marketPosition.pnl?.value > 0 ? '+' : ''}{marketPosition.pnl?.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                                                        <div>({marketPosition.pnl?.value > 0 ? '+' : ''}{marketPosition.pnl?.percent.toLocaleString(undefined, { maximumFractionDigits: 4 })}%)</div>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {autoBet?.[market.toUpperCase()]?.enabled == true ?

                                                            <div className='row align-items-center justify-content-center py-2'>

                                                                <div className='col-lg-8'>

                                                                    <div className={`card-container pt-4 dark-bg mt-4`}>

                                                                        <center>

                                                                            <span className='text-light wait-entry my-2'>Auto-Stake is Enabled <img src={getImageUrl('bot-click.png')} className='send-icon mx-2' /></span>

                                                                            <div className='my-3'>

                                                                                <div className='entry-amount-alt d-flex align-items-center justify-content-center'>
                                                                                    <span className='col-md-auto my-1'>
                                                                                        <center>
                                                                                            <img src={getImageUrl('coin.png')} className='coin-small mx-2' />
                                                                                            <span className='col-md-auto mx-2 my-1 text-white'>
                                                                                                {autoBet?.[market.toUpperCase()]?.configuration?.amount.toLocaleString()}{autoBet?.[market.toUpperCase()]?.configuration?.type == 'percent' ? '%' : ''}
                                                                                            </span>
                                                                                        </center>
                                                                                    </span>
                                                                                    <span className='mx-2'>
                                                                                        <div className={`rounds ${autoBet?.[market.toUpperCase()]?.configuration?.direction}`}>
                                                                                            <div className='round-state'>{autoBet?.[market.toUpperCase()]?.configuration?.direction == 'down' ? '↘' : '↗'} {autoBet?.[market.toUpperCase()]?.configuration?.direction?.toUpperCase()}</div>
                                                                                        </div>
                                                                                    </span>
                                                                                </div>

                                                                            </div>

                                                                            <div className='my-3'>
                                                                                <button className='cancel-auto-stake' onClick={() => cancelAuto()}>
                                                                                    <img src={getImageUrl('close.png')} className='cancel-close me-1' />
                                                                                    <span>Disable Auto-Stake</span>
                                                                                </button>
                                                                            </div>

                                                                            <div className='my-2 mb-0 d-flex align-items-center justify-content-center px-5'>
                                                                                {profile?.balance < autoBet?.[market.toUpperCase()]?.configuration?.amount && profile?.balance < autoBet?.[market.toUpperCase()]?.configuration?.type == 'fixed' ?
                                                                                    <span className='text-error'>
                                                                                        <i className='fas fa-exclamation-circle me-2'></i>
                                                                                        Your balance is insufficient for auto-staking with {autoBet?.[market.toUpperCase()]?.configuration?.amount.toLocaleString()} BNB.
                                                                                        <br />Kindly deposit more tokens into your vault!
                                                                                    </span>
                                                                                    :
                                                                                    null
                                                                                }
                                                                            </div>

                                                                        </center>

                                                                    </div>

                                                                </div>

                                                            </div>
                                                            : null
                                                        }

                                                    </>
                                                    : null
                                                }

                                                {inMarket == false && marketState == 1 && loading == false ?
                                                    <div className='row px-5 justify-content-center py-5 pb-0'>
                                                        <center>
                                                            <span className='text-light wait-entry'>Wait for next entry <img src={getImageUrl('send.png')} className='send-icon mx-2' /></span>
                                                        </center>
                                                    </div>
                                                    : null
                                                }

                                                <div className='row justify-content-center align-items-center py-4'>

                                                    {orders?.length > 0 ?
                                                        <>

                                                            <center>
                                                                <img src={getImageUrl('arrow-down.png')} className='arrow-down' />
                                                            </center>

                                                            <div className='row justify-content-center mt-4'>
                                                                <div className='col-md-11'>
                                                                    <div className='sub-title mx-3'>Latest orders</div>
                                                                </div>
                                                                <div className='col-md-11'>
                                                                    <table className='my-5 mt-4 w-100' cellSpacing={0} cellPadding={0}>
                                                                        <thead className='table-head'>
                                                                            <tr>
                                                                                <td scope="col">Account</td>
                                                                                <td scope="col">Order</td>
                                                                                <td scope="col" style={{ textAlign: "right" }}>Amount</td>
                                                                                <td scope="col">Pot. PNL</td>
                                                                                <td scope="col">Time</td>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className='table-body'>
                                                                            {orders?.map((value) => {
                                                                                return <OrderItem key={value.address} address={value.address} direction={marketDirection?.toLowerCase()} volumes={volumes} amount={value.amount} userDirection={value.entry.toLowerCase()} username={value.username} timestamp={value.date_created} />
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </> : null
                                                    }

                                                </div>

                                            </>
                                        }

                                    </div>

                                    <div className='col-lg-3 order-xl-4 order-4 py-4 pb-5 px-3'>

                                        <Carousel
                                            responsive={responsive}
                                            infinite={true}
                                            autoPlay={true}
                                            autoPlaySpeed={10000}
                                            keyBoardControl={false}
                                            showDots={false}
                                            arrows={false}
                                            draggable={false}
                                            swipeable={false}
                                            containerClass="my-2 carousel-slides"
                                        >

                                            {ads.map((value, index) => {
                                                return <img loading='lazy' onClick={() => clickAd(value.url)} key={index} src={getImageUrl(value.media)} style={{ width: "100%", height: "auto" }} />
                                            })}

                                        </Carousel>

                                    </div>

                                </div>

                            </div>

                        </div>

                        <div ref={chatScreenRef} className={`chat-section ${showChatWindow == true && windowSize.width > 900 ? 'show' : ''} order-lg-1 bordered-section action-section p-0`}>

                            <div className='px-3 w-100 action-section-head'>
                                <div className='online-status px-2 py-3'>
                                    <img src={getImageUrl('online-dot.png')} className='online-dot me-2' />
                                    <span className='d-flex align-items-center justify-content-start'>
                                        <span>Online ({online.toLocaleString()})</span>
                                        <Info text='Number of users active on the current market' />
                                    </span>
                                </div>
                                <div className='show-on-mobile'>
                                    <img src={getImageUrl('close.png')} className='close-chat py-3' onClick={() => toggleChatWindow()} />
                                </div>
                                <div className='show-on-desktop'>
                                    <Socials />
                                </div>
                            </div>

                            <div className='chat-window px-3' ref={chatWindowRef}>
                                {chats[market]?.map((value, index) => {
                                    return <ChatItem value={value} key={index} />
                                })}
                            </div>

                            <div className='px-3 py-2 pt-0 mt-0'>
                                <div className='my-2 mt-0'>
                                    <EmojiTray emojis={emojis} onSend={sendEmoji} badge={profile?.badge} />
                                    <textarea className='chat-field' onKeyDown={(e) => { e.key == "Enter" ? (() => { sendChat(); e.preventDefault() })() : null }} ref={chatInputRef} cols={2} placeholder='Enter your message...' value={text} onInput={(e) => setText(e.target.value)}></textarea>
                                </div>
                                {web3Address == null ?
                                    <div className='my-3 px-3'>
                                        <center>
                                            <div className='light-text justify-content-center'>Connect your wallet to chat!</div>
                                        </center>
                                    </div>
                                    :
                                    <div className='my-2'>
                                        <button className='flat-button chat w-100' onClick={() => sendChat()}>
                                            <img src={getImageUrl('send.png')} className='send-icon me-2' />
                                            Send it!
                                        </button>
                                    </div>
                                }
                            </div>

                        </div>

                    </div>

                </>
            }

        </div>
    );
};

export default Home;
