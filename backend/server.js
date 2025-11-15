const express = require("express");

const bodyParser = require("body-parser");
const cors = require("cors");

const axios = require("axios");

const http = require('http');
const socketIo = require('socket.io');

const WebSocket = require("ws");

const {
    migrations
} = require("./lib/database");

const {
    getTimestamp,
    getPublicClient,
    getRewardsProgression,
    pointsDistribution,
    COMMISSION,
    SECONDS_IN_A_WEEK
} = require("./lib/utils");

const {
    trainAndPredict
} = require("./lib/tf-model");

const {
    loadRankings,
    socketAuth,
    getFallbackPrices,
    getTokenPriceInUSD,
    placeOrderFromAccount
} = require("./lib/helpers");

const marketStore = require("./lib/store");

const psql = require("./database/connection");

const authRoutes = require("./routes/Auth.route");
const shareRoutes = require("./routes/Share.route");
const tradingRoutes = require("./routes/Trading.route");

require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 5000;

app.set('trust proxy', true);

app.use(bodyParser.json({
    limit: '15mb'
}));

app.use(bodyParser.urlencoded({
    limit: '15mb',
    extended: true
}));

const allowedOrigins = ['https://localhost:5173', 'https://moonride.fun', 'https://www.moonride.fun', 'https://testnet.moonride.fun'];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
    optionsSuccessStatus: 204,
};

app.options('*', cors(corsOptions));

app.use(cors(corsOptions));

// API Endpoints

app.use("/share", shareRoutes);

app.use("/auth", authRoutes);

app.use("/trading", tradingRoutes);

// Endpoints End Here

const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 5e7,
    pingInterval: 60000,
    pingTimeout: 30000
});

const processBatchTransfers = async (shouldNotify = false, distributions, namespace, symbol, direction, adminCashout = 0, callback = null, reason = null, winningVolume = 0, losingVolume = 0, losersMap = new Map(), isRefundResolution = false) => {

    const batchSize = 100;

    const entriesArray = Array.from(distributions.entries());
    const totalEntries = entriesArray.length;

    const losersArray = Array.from(losersMap.entries());
    const totalLosers = losersArray.length;

    if (shouldNotify == true) {
        namespace.emit('resolved', {
            symbol,
            direction,
            reason,
            winningVolume: winningVolume / 1e18,
            losingVolume: losingVolume / 1e18
        });
    }

    try {

        await psql.query('BEGIN');

        for (let i = 0; i < totalEntries; i += batchSize) {

            const batch = entriesArray.slice(i, i + batchSize);
            const addresses = [];
            const amounts = [];
            const pnls = [];
            const ids = [];

            batch.forEach(([address, data]) => {

                addresses.push(address);
                amounts.push(data.amount);
                pnls.push(data.pnl);

                if (isRefundResolution == true) {
                    ids.push(data.id);
                }

            });

            const updateQuery = `WITH updates AS (
                SELECT 
                    unnest($1::text[]) AS address,
                    unnest($2::numeric[]) AS amount,
                    unnest($3::double precision[]) AS pnl,
                    unnest($4::int[]) AS id
                ),
                upd AS (
                    UPDATE accounts u
                    SET pnl = u.pnl + t.pnl,
                        balance = u.balance + t.amount
                        ${reason == 'winners_distribution' ? `, points = u.points + ${pointsDistribution.forWins}, leaderboard_points = u.leaderboard_points + ${pointsDistribution.forWins}` : ''}
                    FROM updates t
                    WHERE u.address = t.address
                    RETURNING *
                )
                DELETE FROM order_history o
                USING updates t
                WHERE o.trade_id = t.id AND 
                    array_length($4::int[], 1) > 0
                `;

            await psql.query({
                text: updateQuery,
                values: [addresses, amounts, pnls, ids]
            });

        }

        if (totalLosers > 0) {

            for (let i = 0; i < totalLosers; i += batchSize) {

                const batch = losersArray.slice(i, i + batchSize);
                const addresses = [];
                const amounts = [];
                const pnls = [];

                batch.forEach(([address, data]) => {
                    addresses.push(address);
                    amounts.push(data.amount);
                    pnls.push(data.pnl);
                });

                const updateQuery = `WITH updates AS (
                    SELECT 
                        unnest($1::text[]) AS address,
                        unnest($2::numeric[]) AS amount,
                        unnest($3::double precision[]) AS pnl
                    )
                    UPDATE accounts u
                    SET pnl = u.pnl + t.pnl
                    FROM updates t
                    WHERE u.address = t.address
                `;

                await psql.query({
                    text: updateQuery,
                    values: [addresses, amounts, pnls]
                });

            }

        }

        if (callback != null) {
            await callback();
        }

        if (adminCashout > 0) {
            await psql.query({
                text: `UPDATE platform_commission SET amount = amount + $1 WHERE access_key = $2`,
                values: [parseFloat(adminCashout), 'fees']
            });
        }

        await psql.query("COMMIT");

    }

    catch (error) {
        await psql.query('ROLLBACK');
    }

}

const resolveMarket = async (symbol, direction, round) => {

    const winningDirection = direction;
    const losingDirection = direction == 'up' ? 'down' : 'up';

    let adminCashout = 0;

    let distributions = new Map();
    let losersMap = new Map();

    let reason = null;

    const namespace = marketStore.namespaces[symbol];

    if (winningDirection != 'mid') {

        const winningSide = marketStore.trades[symbol][winningDirection];
        const losingSide = marketStore.trades[symbol][losingDirection];
        const winningVolume = marketStore.volumes[symbol][winningDirection];
        const losingVolume = marketStore.volumes[symbol][losingDirection];

        try {

            await psql.query({
                text: `UPDATE order_history SET winning_volume = $1, losing_volume = $2, market_resolution = $3 WHERE round = $4 AND symbol = $5`,
                values: [winningVolume, losingVolume, winningDirection, round, symbol]
            });

        }
        catch (error) { }

        if (losingVolume == 0 && winningVolume > 0) {

            for (const key of winningSide.keys()) {

                distributions.set(key, { amount: winningSide.get(key), pnl: 0 });

            }

            reason = 'no_wager_refund';

            adminCashout = 0;

        }
        else if (losingVolume > 0 && winningVolume > 0) {

            adminCashout = COMMISSION * losingVolume;

            const rewardsPool = losingVolume - adminCashout;

            for (const key of winningSide.keys()) {

                const win = (winningSide.get(key) / winningVolume) * rewardsPool;

                distributions.set(key, { amount: winningSide.get(key) + win, pnl: win });

            }

            for (const key of losingSide.keys()) {

                losersMap.set(key, { amount: 0, pnl: losingSide.get(key) * -1 });

            }

            reason = 'winners_distribution';

        }
        else if (losingVolume > 0 && winningVolume == 0) {

            adminCashout = losingVolume;

            for (const key of losingSide.keys()) {

                losersMap.set(key, { amount: 0, pnl: losingSide.get(key) * -1 });

            }

            reason = 'no_winners';

        }
        else if (losingVolume == 0 && winningVolume == 0) {

            reason = "no_stakes_in_round";

            adminCashout = 0;

        }

        if (reason != "no_stakes_in_round") {

            await processBatchTransfers(true, distributions, namespace, symbol, direction, adminCashout, null, reason, winningVolume, losingVolume, losersMap);

        }

    }
    else {

        const upVolume = marketStore.volumes[symbol]['up'];
        const downVolume = marketStore.volumes[symbol]['down'];

        adminCashout = upVolume + downVolume;

        reason = 'no_winners';

        await processBatchTransfers(true, distributions, namespace, symbol, direction, adminCashout, null, reason, upVolume, downVolume, losersMap);

    }

    marketStore.trades[symbol] = {
        up: new Map(),
        down: new Map()
    };

    marketStore.volumes[symbol] = {
        up: 0,
        down: 0
    };

}

const refundUnresolved = async () => {

    try {

        console.log("Refunding Unresolved trades...");

        let distributions = new Map();

        const tradesQuery = await psql.query({
            text: `SELECT * FROM trades`,
            values: []
        });

        for (let item of tradesQuery.rows) {
            distributions.set(item.address, { amount: parseFloat(item.amount), win: 0, id: item.id });
        }

        await processBatchTransfers(false, distributions, null, null, null, 0, async () => {
            await psql.query({
                text: `DELETE FROM trades`
            });
        }, 'refunds', 0, 0, new Map(), true);

        const count = Array.from(distributions.entries()).length;

        if (count > 0) {
            console.log(`Resolved entries: ${count}`);
        }

    }
    catch (error) {
        console.log(error);
    }

}

let resolvingLeaderboard = false;

let progression;

const resolveLeaderboard = async (times) => {

    try {

        console.log("Resolving Leaderboard");

        await psql.query("BEGIN");

        const ranks = await loadRankings(marketStore);

        const price = await getTokenPriceInUSD('BNB');

        progression = getRewardsProgression(price);

        exchangeRate = price;

        let index = 0;

        for (let item of ranks) {

            const amount = Math.floor(progression[index] * 1e18);

            const account = item.address;

            await psql.query({
                text: `UPDATE accounts SET balance = balance + $1 WHERE address = $2`,
                values: [amount, account]
            });

            index++;

        }

        console.log(`Amounts sent to the top rankers`);

        await psql.query({
            text: `UPDATE market_state SET entries = $1 WHERE symbol = 'leaderboard'`,
            values: [JSON.stringify(times)]
        });

        await psql.query({
            text: `UPDATE accounts SET leaderboard_points = 0, pnl = 0`,
            values: []
        });

        await psql.query("COMMIT");

        console.log("Leaderboard Resolved");

        resolvingLeaderboard = false;

    }
    catch (error) {

        console.log(error);

        await psql.query("ROLLBACK");

        console.log("Failed to resolve leaderboard");

        resolvingLeaderboard = false;

    }

}

const executeAutoTrades = async (symbol) => {

    console.log(`Auto-Stakes executing for ${symbol}`);

    const accountsQuery = await psql.query({
        text: `SELECT * FROM accounts WHERE auto_trading -> $1 ->> 'enabled' = 'true'`,
        values: [symbol]
    });

    const accounts = accountsQuery.rows;

    if (accounts.length > 0) {

        let position = 0;

        let results = [];

        const batchSize = 100;

        while (position < accounts.length) {

            const batch = accounts.slice(position, position + batchSize);

            const batchResults = await Promise.all(batch.map(async (x) => {

                const autoTrading = x.auto_trading;
                const direction = autoTrading[symbol].configuration.direction;
                const amount = autoTrading[symbol].configuration.amount * 1e18;
                const userBalance = parseFloat(x.balance);

                let betAmount;

                if (autoTrading[symbol].configuration.type == "fixed") {
                    betAmount = amount; // Use fixed value
                }
                else {
                    betAmount = ((amount / 1e18) / 100) * userBalance; // Calculate balance percent
                }

                let result = false;

                if (userBalance >= betAmount) {

                    result = await placeOrderFromAccount(x, betAmount, symbol, direction, marketStore, undefined, false);

                }
                else {

                    await psql.query({
                        text: `UPDATE accounts
                            SET auto_trading = jsonb_set(
                                jsonb_set(
                                    auto_trading,
                                    ARRAY['${symbol}', 'enabled'],
                                    'false'::jsonb,
                                    true
                                ),
                                ARRAY['${symbol}', 'configuration'],
                                '{}'::jsonb,
                                true
                            )
                            WHERE address = $1
                        `,
                        values: [x.address]
                    });

                    result = 'Insufficient balance. Auto-staking disabled';

                }

                return result;

            }));

            results = results.concat(batchResults);

            position += batchSize;

        }

        console.log(`Auto-Stakes Executed for ${symbol}`, results);

    }

}

const startMarket = async () => {

    const symbols = marketStore.symbols;

    let exchangeRate = 0;

    const stateQuery = await psql.query({
        text: `SELECT * FROM market_state WHERE symbol != 'leaderboard'`,
        values: []
    });

    const leaderboardQuery = await psql.query({
        text: `SELECT * FROM market_state WHERE symbol = 'leaderboard'`,
        values: []
    });

    const leaderboardData = leaderboardQuery.rows[0].entries;

    let leaderboardTimes = leaderboardData;

    const time = Math.floor(new Date().getTime() / 1000);

    if (leaderboardTimes.endDate < time) {

        leaderboardTimes = {
            startTime: time,
            endTime: time + SECONDS_IN_A_WEEK
        };

        await psql.query({
            text: `UPDATE market_state SET entries = $1 WHERE symbol = 'leaderboard'`,
            values: [JSON.stringify(leaderboardTimes)]
        });

    }

    const chatCounts = {};

    const globalStates = stateQuery.rows.reduce((accumulator, row) => {
        accumulator[row.symbol] = row.entries;
        return accumulator;
    }, {});

    await refundUnresolved();

    let leaderboard = {};

    let pricesList = {};

    for (let symbol of symbols) {

        leaderboard[symbol] = { ...leaderboardTimes };

        const timestamp = Math.floor(new Date().getTime() / 1000);
        leaderboard[symbol].timestamp = timestamp;

        const tradingNamespace = io.of(`/${symbol.toLowerCase()}`);
        tradingNamespace.use(socketAuth);

        marketStore.namespaces[symbol] = tradingNamespace;

        marketStore.trades[symbol] = {
            up: new Map(),
            down: new Map()
        };

        marketStore.volumes[symbol] = {
            up: 0,
            down: 0
        };

        let roundIndex = globalStates[symbol].roundIndex;

        let counter = globalStates[symbol].counter;

        let state = globalStates[symbol].state;

        let roundStartPrice = globalStates[symbol].roundStartPrice;

        let roundEndPrice = globalStates[symbol].roundEndPrice;

        let outcomes = globalStates[symbol].outcomes;

        let direction = globalStates[symbol].direction;

        let bullishCount = null;

        let bearishCount = null;

        let hasFetched = false;

        const AIResult = {
            initialized: false,
            result: null
        };

        const onlineUsers = new Set();

        tradingNamespace.on('connection', (socket) => {

            onlineUsers.add(socket.identity.account.address);

            socket.on('message', async (data) => {

                if (marketStore.namespaces.hasOwnProperty(data.market.toUpperCase())) {

                    const namespace = marketStore.namespaces[data.market.toUpperCase()];

                    const account = socket.identity.account;

                    if (data.type == "text") {
                        namespace.emit('message', {
                            message: { type: "text", content: data.message },
                            timestamp: Math.floor((new Date().getTime() / 1000)),
                            sender: account,
                            market: data.market
                        });
                    }
                    else {
                        const index = socket.identity.account.badge.index;
                        const emojiList = marketStore.emojis.filter(x => x.id == data.message.id);
                        const emoji = emojiList?.[0] || false;
                        if (emoji == false) {
                            return false;
                        }
                        if (index == 1 && emoji.noobUnlocked == false) {
                            return false;
                        }
                        namespace.emit('message', {
                            message: { type: "emoji", media: emoji.id },
                            timestamp: Math.floor((new Date().getTime() / 1000)),
                            sender: account,
                            market: data.market
                        });
                    }

                    const address = socket.identity.account.address

                    if (chatCounts.hasOwnProperty(address)) {
                        chatCounts[address]++;
                    }
                    else {
                        chatCounts[address] = 1;
                    }

                    if (chatCounts[address] == 100) {

                        try {
                            await psql.query({
                                text: `UPDATE accounts SET points = points + $1, leaderboard_points = leaderboard_points + $1 WHERE address = $2`,
                                values: [pointsDistribution.forChats, address]
                            });
                            chatCounts[address] = 0;
                        }
                        catch (error) { }

                    }

                }

            });

            socket.on('vote', (index) => {

                let votingPower = socket.identity.account.badge.index;

                if (index == 0) {
                    bearishCount += votingPower;
                }
                else if (index == 1) {
                    bullishCount += votingPower;
                }
                if (bearishCount == null) {
                    bearishCount = 0;
                }
                if (bullishCount == null) {
                    bullishCount = 0;
                }

            });

            socket.on('disconnect', () => {

                onlineUsers.delete(socket.identity?.account?.address);

                socket.off('message', () => { });
                socket.off('vote', () => { });

            });

        });

        setTimeout(() => {

            setInterval(async () => {

                counter++;

                const predictAndGetResults = async (prices, timestamps, pricesList) => {
                    const results = await trainAndPredict(prices, timestamps, pricesList, symbol);
                    const start = results[0].price;
                    const end = results[results.length - 1].price;
                    let output = null;
                    if (end < start) {
                        output = 'DOWN';
                    }
                    else if (end > start) {
                        output = 'UP';
                    }
                    else if (end == start) {
                        output = 'MID';
                    }
                    AIResult.initialized = true;
                    AIResult.result = output;
                }

                if (pricesList.hasOwnProperty(symbol)) {
                    if (hasFetched == true) {
                        if (counter == 1) {
                            const assetPrices = pricesList[symbol].map(x => x.price);
                            const assetTimestamps = pricesList[symbol].map(x => Math.floor(x.timestamp));
                            predictAndGetResults(assetPrices, assetTimestamps, pricesList);
                            pricesList[symbol].length = 0;
                        }
                    }
                }

                if (counter == 10) {
                    executeAutoTrades(symbol);
                }

                leaderboard[symbol].timestamp++;

                if (leaderboard[symbol].timestamp >= leaderboard[symbol].endTime) {

                    let times = {
                        startTime: leaderboard[symbol].timestamp,
                        endTime: leaderboard[symbol].timestamp + SECONDS_IN_A_WEEK,
                        timestamp: leaderboard[symbol].timestamp
                    };

                    leaderboard[symbol] = times;

                    if (resolvingLeaderboard == false) {
                        setTimeout(() => {
                            resolveLeaderboard(times);
                        }, 5000);
                        resolvingLeaderboard = true;
                    }

                }

                if (counter == 30) { // Round stakes 30 secs

                    state = 1;

                    roundIndex++;

                    if (globalStates[symbol].roundPrices.length > 0) {
                        roundStartPrice = globalStates[symbol].roundPrices?.[0]?.price || 0;
                        globalStates[symbol].roundPrices = [globalStates[symbol].roundPrices[0]];
                    }

                }

                if (globalStates[symbol].roundPrices.length > 0) {

                    let currentPrice = globalStates[symbol].roundPrices?.[globalStates[symbol].roundPrices.length - 1]?.price || 0;

                    if (currentPrice > roundStartPrice) {

                        direction = "UP";

                        if (bullishCount == null) {
                            bullishCount = 1;
                            bearishCount = 0;
                        }

                    }
                    else if (currentPrice < roundStartPrice) {

                        direction = "DOWN";

                        if (bullishCount == null) {
                            bullishCount = 0;
                            bearishCount = 1;
                        }

                    }
                    else if (currentPrice == roundStartPrice) {

                        direction = "MID";

                        if (bullishCount == null) {
                            bullishCount = 1;
                            bearishCount = 1;
                        }

                    }

                }

                if (counter == 60) { // Watching lasts for 30 seconds (+ 30)

                    hasFetched = true;
                    AIResult.initialized = false;
                    AIResult.result = null;

                    state = 0;
                    counter = 0;

                    roundEndPrice = globalStates[symbol].roundPrices?.[globalStates[symbol].roundPrices.length - 1]?.price || 0;
                    globalStates[symbol].roundPrices = [];

                    let result = null;

                    if (roundEndPrice > roundStartPrice) {
                        result = "UP";
                    }
                    else if (roundEndPrice < roundStartPrice) {
                        result = "DOWN";
                    }
                    else if (roundEndPrice == roundStartPrice) {
                        result = "MID";
                    }

                    bullishCount = null;
                    bearishCount = null;

                    direction = result;

                    outcomes.push(result);

                    resolveMarket(symbol, result?.toLowerCase(), roundIndex);

                    psql.query({
                        text: `DELETE FROM trades`,
                        values: []
                    });

                    if (outcomes.length > 30) {
                        outcomes = outcomes.slice(outcomes.length - 30);
                    }

                    roundStartPrice = 0;
                    roundEndPrice = 0;



                }

                const responseObject = {
                    pricing: globalStates[symbol].roundPrices,
                    startPrice: roundStartPrice,
                    endPrice: roundEndPrice,
                    ticker: symbol,
                    history: [...outcomes].reverse(),
                    round: roundIndex,
                    roundStatus: state,
                    counter: counter,
                    direction,
                    symbols,
                    online: onlineUsers.size,
                    up: {
                        participants: marketStore.trades[symbol].up.size,
                        volume: marketStore.volumes[symbol].up
                    },
                    down: {
                        participants: marketStore.trades[symbol].down.size,
                        volume: marketStore.volumes[symbol].down
                    },
                    leaderboard: leaderboard[symbol],
                    exchangeRate,
                    rewardsDistribution: progression,
                    bullishCount,
                    bearishCount,
                    AIResult,
                    emojis: marketStore.emojis
                };

                tradingNamespace.emit('data', responseObject);

                marketStore.markets[symbol] = responseObject;

                app.locals.marketStore = marketStore;

                psql.query({
                    text: `UPDATE market_state SET entries = $1 WHERE symbol = $2`,
                    values: [JSON.stringify({
                        roundPrices: [],
                        roundIndex,
                        counter: 0,
                        state: 0,
                        price: 0,
                        roundStartPrice: 0,
                        roundEndPrice: 0,
                        outcomes,
                        direction,
                        bullishCount: 0,
                        bearishCount: 0
                    }), symbol]
                });

            }, 1000);

        }, 3000);

    }

    let lastExchangeRateQuery = 0;

    const getExchangeRate = async () => {

        const time = Math.floor(new Date().getTime() / 1000);

        if (lastExchangeRateQuery < time) {

            const tokenPrice = await getTokenPriceInUSD('BNB');

            lastExchangeRateQuery = time + 720;

            progression = getRewardsProgression(tokenPrice);

            exchangeRate = tokenPrice;

        }

    }

    const streams = marketStore.symbols.map(s => s.toLowerCase() + 'usdt@trade').join('/');
    const wsUrl = `wss://data-stream.binance.vision/stream?streams=${streams}`;

    let ws;
    let reconnectTimeout = null;
    let reconnectDelay = 1500;

    const pricesCache = {};

    function connectWebSocket() {

        ws = new WebSocket(wsUrl);

        ws.on('open', () => {
            console.log('Connected to Binance WebSocket streams:', marketStore.symbols.join(', '));
        });

        ws.on('message', (data) => {
            try {
                const parsed = JSON.parse(data);
                if (parsed.data && parsed.data.e === 'trade') {
                    const trade = parsed.data;
                    const price = parseFloat(trade.p);
                    const timestamp = Math.floor(trade.T / 1000);
                    const index = trade.s.replace("USDT", '');
                    pricesCache[index] = {
                        price,
                        timestamp
                    };
                }
            } catch (err) {
                console.log(err);
            }
        });

        ws.on('close', () => {
            scheduleReconnect();
        });

        ws.on('error', (err) => {
            scheduleReconnect();
        });

        ws.on('ping', () => {
            ws.pong();
        });
    }

    function scheduleReconnect() {
        if (!reconnectTimeout) {
            reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                connectWebSocket();
            }, reconnectDelay);
        }
    }

    connectWebSocket();

    const getPrices = async () => {

        for (let key of Object.keys(pricesCache)) {
            const item = pricesCache[key];
            globalStates[key].roundPrices.push(item);
            if (pricesList.hasOwnProperty(key)) {
                pricesList[key].push(item);
            }
            else {
                pricesList[key] = [item];
            }
        }

        try {
            await getExchangeRate();
        } catch (error) { }

        const min = 250;
        const max = 1000;

        setTimeout(getPrices, Math.floor(Math.random() * (max - min + 1)) + min);

    };

    getPrices();

}

const VaultABI = require('./lib/abis/Vault.json');

const initializeEventListeners = async () => {

    let publicClient = await getPublicClient();

    console.log(`On-chain event listeners started for Vault (${process.env.VAULT_ADDRESS})`);

    const remitDeposit = async (data, txHash) => {

        await psql.query({
            text: `UPDATE accounts SET balance = balance + $1, points = points + $2, leaderboard_points = leaderboard_points + $2 WHERE address = $3`,
            values: [parseFloat(data.amount), pointsDistribution.forDeposits, data.account]
        });

        const time = Math.floor(new Date().getTime() / 1000);

        try {
            await psql.query({
                text: `INSERT INTO transaction_history (address, amount, txn_type, txhash, date_created) VALUES ($1, $2, $3, $4, $5)`,
                values: [data.account, data.amount, 'DEPOSIT', txHash, time]
            });
        }
        catch (error) { }

        console.log(`Deposit confirmed: ${parseFloat(data.amount) / 1e18} ETH (${data.account})`);

    }

    unwatch = publicClient.watchContractEvent({
        address: process.env.VAULT_ADDRESS,
        abi: VaultABI,
        eventName: 'Deposit',
        batch: false,
        onLogs: async (logs) => {
            for (let log of logs) {
                const data = log.args;
                remitDeposit(data, log.transactionHash);
            }
        },
        onError: async (_error) => {
            console.log(`On-chain event listener quit, restarting...`, _error);
            if (unwatch) await unwatch();
            console.log(`Socket disconnected, restarting...`);
            initializeEventListeners();
        }
    });

}

// Start app
server.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
});

// PostgreSQL connection
psql.connect().then(async () => {
    console.log('Connected to PostgreSQL database. Migrations started');
    await migrations(marketStore.symbols);
    try {
        startMarket();
    }
    catch (error) {
        console.log("Failed to start market");
    }
    console.log('Migrations completed');
    console.log('Market Started');
    initializeEventListeners();
}).catch((err) => {
    console.error('Error connecting to PostgreSQL database', err);
});