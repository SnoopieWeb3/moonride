const psql = require("../database/connection");
const axios = require("axios");

const { pointsDistribution } = require("./utils");

const marketStore = require("./store");

const getTokenPriceInUSD = async (symbol) => {

    let price = 0;

    try {

        const response = await axios.get(`https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&symbol=${symbol}&convert=USDT&CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`);

        price = parseFloat(response.data.data[0].quote['USDT'].price);

    }
    catch (error) {
        console.log(error);
    }

    return price;

}

const getFallbackPrices = async () => {

    const symbols = marketStore.symbols;

    let prices = Array.from({ length: symbols.length }, () => 0);

    try {

        let index = 0;

        let results = [];

        for (let symbol of symbols) {

            const response = await axios.get(`https://pro-api.coinmarketcap.com/v2/tools/price-conversion?amount=1&symbol=USDT&convert=${symbol}&CMC_PRO_API_KEY=${process.env.CMC_API_KEY}`);

            const data = response.data;

            const price = 1 / parseFloat(data.data[0].quote[symbol].price);

            results.push(price);

            index++;

        }

        prices = [...results];

    }
    catch (error) {
        console.log(error);
    }

    return prices;

}

const placeOrderFromAccount = async (user, tradeAmount, marketSymbol, marketDirection, marketStore, res = undefined, fromDirect = false) => {

    const time = Math.floor(new Date().getTime() / 1000);

    if (tradeAmount > user.balance) {
        if (res) {
            return res.status(200).json({
                status: "error",
                message: "Insufficient vault balance. Please deposit some ETH and try again"
            });
        }
        else {
            return 'Insufficient vault balance';
        }
    }

    if (marketStore.markets[marketSymbol].roundStatus != 0) {
        if (res) {
            return res.status(200).json({
                status: "error",
                message: "Must be in betting window to place a bet"
            });
        }
        else {
            return 'Must be in betting window';
        }
    }

    if (marketStore.trades[marketSymbol]['up'].get(user.address) || marketStore.trades[marketSymbol]['down'].get(user.address)) {
        if (res) {
            return res.status(200).json({
                status: "error",
                message: "Already placed bet!"
            });
        }
        else {
            return 'Already placed bet';
        }
    }

    try {

        await psql.query('BEGIN');

        marketStore.trades[marketSymbol][marketDirection].set(user.address, tradeAmount);

        marketStore.volumes[marketSymbol][marketDirection] += tradeAmount;

        if (fromDirect == true) {
            await psql.query({
                text: `UPDATE accounts SET balance = balance - $1, points = points + $2, leaderboard_points = leaderboard_points + $2 WHERE address = $3 AND balance >= $4`,
                values: [tradeAmount, pointsDistribution.forTrades, user.address, tradeAmount]
            });
        }
        else {
            await psql.query({
                text: `UPDATE accounts SET balance = balance - $1 WHERE address = $2 AND balance >= $3`,
                values: [tradeAmount, user.address, tradeAmount]
            });
        }

        await psql.query({
            text: `UPDATE platform_commission SET amount = amount + $1 WHERE access_key = $2`,
            values: [tradeAmount, 'volume']
        });

        const result = await psql.query({
            text: `INSERT INTO trades (address, symbol, amount, round, entry, date_created) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            values: [user.address, marketSymbol, tradeAmount, marketStore.markets[marketSymbol].round + 1, marketDirection, time]
        });

        const insertedId = result.rows[0].id;

        await psql.query({
            text: `INSERT INTO order_history (trade_id, address, symbol, amount, round, entry, is_auto_trade, date_created) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            values: [insertedId, user.address, marketSymbol, tradeAmount, marketStore.markets[marketSymbol].round + 1, marketDirection, !fromDirect, time]
        });

        try {
            marketStore.namespaces[marketSymbol].emit('trade', {
                address: user.address,
                amount: tradeAmount / 1e18,
                market: marketSymbol,
                direction: marketDirection,
                username: user.username,
                badge: generateBadge(parseFloat(user.points)),
                fromDirect
            });
        }
        catch (error) { }

        await psql.query('COMMIT');

        if (res) {
            return res.status(200).json({
                status: "success",
                message: "Order Executed successfully"
            });
        }
        else {
            return 'Order executed';
        }

    }
    catch (error) {

        marketStore.trades[marketSymbol][marketDirection].delete(user.address);

        marketStore.volumes[marketSymbol][marketDirection] -= tradeAmount;

        await psql.query('ROLLBACK');

        if (res) {
            throw error;
        }

        console.log(error);

        return 'Order placement failed';

    }

}

const loadRankings = async (marketStore) => {

    const topQueryText = `
        SELECT
            address,
            leaderboard_points,
            username,
            pnl,
            points,
            ROW_NUMBER() OVER (ORDER BY leaderboard_points DESC, points DESC, pnl DESC) AS rank
        FROM accounts
        ORDER BY leaderboard_points DESC, points DESC
        LIMIT 25
    `;

    const { rows: top } = await psql.query({
        text: topQueryText
    });

    const leaderboard = top.map(row => {

        const rank = parseFloat(row.rank);

        return {
            address: row.address,
            points: parseFloat(row.leaderboard_points),
            username: row.username,
            pnl: parseFloat(row.pnl) / 1e18,
            rank,
            reward: marketStore.markets[marketStore.markets?.[0]?.symbol]?.rewardsDistribution?.[rank] || 0,
            badge: generateBadge(parseFloat(row.points))
        };

    });

    return leaderboard;

}

const generateBadge = (rating) => {
    let badge;
    if (rating < 2500) {
        badge = {
            media: 'badges/noob.png',
            title: 'Noob',
            index: 1
        };
    }
    else if (rating >= 2500 && rating < 12500) {
        badge = {
            media: 'badges/adventurer.png',
            title: 'Adventurer',
            index: 2
        };
    }
    else if (rating >= 12500 && rating < 100000) {
        badge = {
            media: 'badges/meister.png',
            title: 'Meister',
            index: 3
        };
    }
    else if (rating >= 100000 && rating < 350000) {
        badge = {
            media: 'badges/knight.png',
            title: 'Knight',
            index: 4
        };
    }
    else if (rating >= 350000) {
        badge = {
            media: 'badges/emperor.png',
            title: 'Emperor',
            index: 5
        };
    }
    return badge;
}

const socketAuth = async (socket, next) => {

    const token = socket.handshake.auth.token;

    if (!token) {
        return next(new Error('No token provided'));
    }

    try {

        const exists = await psql.query({
            text: 'SELECT username, address, points FROM accounts WHERE token = $1 LIMIT 1',
            values: [token]
        });

        if (exists.rows.length == 0) {

            return next(new Error('Failed to verify'));

        }

        const user = exists.rows[0];

        socket.identity = {
            account: {
                username: user.username,
                address: user.address,
                badge: generateBadge(parseFloat(user.points))
            }
        };

        return next();

    } catch (error) {
        console.log(error);
        return next(new Error('Failed to verify'));
    }

}

module.exports = {
    socketAuth,
    loadRankings,
    getTokenPriceInUSD,
    getFallbackPrices,
    generateBadge,
    placeOrderFromAccount
}