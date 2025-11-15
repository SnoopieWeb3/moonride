const asyncHandler = require("express-async-handler");
const psql = require("../database/connection");

const VaultABI = require('../lib/abis/Vault.json');

const { getPublicClient, getWalletClient, pointsDistribution, COMMISSION } = require("../lib/utils");

const { placeOrderFromAccount } = require("../lib/helpers");

const withdraw = asyncHandler(async (req, res) => {

    try {

        const { amount = 0 } = req.body;

        const withdrawalAmount = Math.floor(((parseFloat(amount) || 0) * 1e18));

        if (withdrawalAmount <= 0) {
            return res.status(200).json({
                status: "error",
                message: "Amount must be greater than 0!"
            });
        }

        const user = req.account;

        if (withdrawalAmount > user.balance) {
            return res.status(200).json({
                status: "error",
                message: "Vault balance is less than the required withdrawal amount"
            });
        }

        try {

            const time = Math.floor(new Date().getTime() / 1000);

            await psql.query('BEGIN');

            await psql.query({
                text: `UPDATE accounts SET balance = balance - $1 WHERE address = $2 AND balance >= $3`,
                values: [withdrawalAmount, user.address, withdrawalAmount]
            });

            await psql.query({
                text: `INSERT INTO withdrawals (address, amount, date_created) VALUES ($1, $2, $3)`,
                values: [user.address, withdrawalAmount, time]
            });

            await psql.query('COMMIT');

            return res.status(200).json({
                status: "success",
                message: "Withdrawal successful"
            });

        }
        catch (error) {

            await psql.query('ROLLBACK');
            throw error;

        }

    }
    catch (error) {

        console.log(error);

        return res.status(401).json({
            status: "error",
            message: "Failed to withdraw from vault"
        });

    }

});

const order = asyncHandler(async (req, res) => {

    try {

        const { direction = null, symbol = null, betType = 'single' } = req.params;

        const { amount = 0, amountType = 'fixed' } = req.body;

        const marketSymbol = symbol.toUpperCase() || null;
        const marketDirection = direction.toLowerCase() || null;

        const marketStore = req.app.locals.marketStore;

        const user = req.account;

        const tradeAmount = Math.floor(((parseFloat(amount) || 0) * 1e18));

        const minStake = 0.0001;

        if (tradeAmount < (minStake * 1e18)) {
            return res.status(200).json({
                status: "error",
                message: `Stake amount must be greater than ${minStake}!`
            });
        }

        if (tradeAmount <= 0) {
            return res.status(200).json({
                status: "error",
                message: "Amount must be greater than 0!"
            });
        }

        if (marketDirection != 'up' && marketDirection != 'down') {
            return res.status(200).json({
                status: "error",
                message: "Direction must be UP or DOWN"
            });
        }

        if (!marketStore?.markets.hasOwnProperty(marketSymbol)) {
            return res.status(200).json({
                status: "error",
                message: "Market symbol must be associated with a registered market"
            });
        }

        if (betType == 'single') {

            const autoTrading = user.auto_trading;

            if (autoTrading[marketSymbol].enabled == true) {
                return res.status(200).json({
                    status: "error",
                    message: "Auto-Staking already enabled. Cancel it to place one-time bets"
                });
            }

            return await placeOrderFromAccount(user, tradeAmount, marketSymbol, marketDirection, marketStore, res, true);

        }
        else {

            if (amountType != 'fixed' && amountType != 'percent') {
                return res.status(200).json({
                    status: "error",
                    message: "Amount must be fixed or percentage value"
                });
            }

            if (amountType == "percent") {
                if (tradeAmount > (0.1 * 1e18) && tradeAmount <= (100 * 1e18)) {
                    // do nothing (between 0.1 and 100%)
                }
                else {
                    return res.status(200).json({
                        status: "error",
                        message: "Percentage must be set between 0.1% and 100%"
                    });
                }
            }

            await psql.query({
                text: `UPDATE accounts
                    SET auto_trading = jsonb_set(
                        jsonb_set(
                            auto_trading,
                            '{${marketSymbol},enabled}',
                            'true'::jsonb,
                            true
                        ),
                        '{${marketSymbol},configuration}',
                        jsonb_build_object('amount', ${amount}, 'type', '${amountType}', 'direction', '${marketDirection}'),
                        true
                    )
                    WHERE address = $1
                `,
                values: [user.address]
            });

            return res.status(200).json({
                status: "success",
                message: "Auto-stake started"
            });

        }

    }
    catch (error) {

        console.log(error);

        return res.status(200).json({
            status: "error",
            message: "Failed to execute order"
        });

    }

});

const cancelAuto = asyncHandler(async (req, res) => {

    try {

        const { symbol = null } = req.params;

        const user = req.account;

        const marketSymbol = symbol.toUpperCase() || null;

        const marketStore = req.app.locals.marketStore;

        if (!marketStore?.markets.hasOwnProperty(marketSymbol)) {
            if (res) {
                return res.status(200).json({
                    status: "error",
                    message: "Market symbol must be associated with a registered market"
                });
            }
            else {
                return false;
            }
        }

        await psql.query({
            text: `UPDATE accounts
                SET auto_trading = jsonb_set(
                    jsonb_set(
                        auto_trading,
                        ARRAY['${marketSymbol}', 'enabled'],
                        'false'::jsonb,
                        true
                    ),
                    ARRAY['${marketSymbol}', 'configuration'],
                    '{}'::jsonb,
                    true
                )
                WHERE address = $1
            `,
            values: [user.address]
        });

        return res.status(200).json({
            status: "success",
            message: "Auto-Stake has been disabled"
        });

    }
    catch (error) {

        console.log(error);

        return res.status(200).json({
            status: "error",
            message: "Failed to disable Auto-Stake"
        });

    }

});

const getEntryStatus = asyncHandler(async (req, res) => {

    try {

        const { symbol = null } = req.params;

        const marketSymbol = symbol.toUpperCase() || null;

        const marketStore = req.app.locals.marketStore;

        if (!marketStore?.markets.hasOwnProperty(marketSymbol)) {
            return res.status(200).json({
                status: "error",
                message: "Market symbol must be associated with a registered market"
            });
        }

        const user = req.account;

        let entry = {
            inMarket: false,
        };

        const directions = ['up', 'down'];

        for (let direction of directions) {

            if (marketStore.trades[marketSymbol][direction].get(user.address)) {

                entry.stake = marketStore.trades[marketSymbol][direction].get(user.address) / 1e18;
                entry.inMarket = true;
                entry.direction = direction;

                let marketDirection = marketStore.markets[marketSymbol].direction?.toLowerCase() || null;
                if (marketStore.markets[marketSymbol].roundStatus == 0) {
                    marketDirection = null;
                }

                if (marketDirection != null && marketDirection != 'mid') {

                    if (marketDirection == direction) {
                        const oppositeDirection = direction == 'up' ? 'down' : 'up';
                        const totalWager = marketStore.volumes[marketSymbol][oppositeDirection] / 1e18;
                        const _wager = totalWager - (COMMISSION * totalWager);
                        const wager = _wager <= 0 ? 0 : _wager;
                        if (wager == 0) {
                            entry.pnl = {
                                value: 0,
                                percent: 0
                            };
                        }
                        else {
                            const totalPool = marketStore.volumes[marketSymbol][direction] / 1e18;
                            const ratio = (entry.stake / totalPool) * wager;
                            entry.pnl = {
                                value: ratio,
                                percent: (ratio / entry.stake) * 100
                            };
                        }

                    }
                    else {
                        entry.pnl = {
                            value: 0,
                            percent: 0
                        };
                    }

                }
                else {
                    entry.pnl = {
                        value: 0,
                        percent: 0
                    };
                }

                break;
            }

        }

        return res.status(200).json({
            status: "success",
            entry,
            autoStake: user.auto_trading
        });

    }
    catch (error) {

        console.log(error);

        return res.status(200).json({
            status: "error",
            message: "Failed to query entry status"
        });

    }

});

const getOrders = asyncHandler(async (req, res) => {

    try {

        const { symbol = null } = req.params;

        const marketSymbol = symbol.toUpperCase() || null;

        const marketStore = req.app.locals.marketStore;

        if (!marketStore?.markets.hasOwnProperty(marketSymbol)) {
            return res.status(200).json({
                status: "error",
                message: "Market symbol must be associated with a registered market"
            });
        }

        const query = await psql.query({
            text: `SELECT * FROM trades WHERE symbol = $1 ORDER BY date_created DESC LIMIT 5`,
            values: [marketSymbol]
        });

        const listOrders = await Promise.all(query.rows.map(async x => {
            const userQuery = await psql.query({
                text: `SELECT username FROM accounts WHERE address = $1 LIMIT 1`,
                values: [x.address]
            });
            const user = userQuery.rows[0];
            x.date_created = parseFloat(x.date_created);
            x.amount = parseFloat(x.amount) / 1e18;
            x.username = user.username;
            delete x.id;
            return x;
        }));

        return res.status(200).json({
            status: "success",
            orders: listOrders.sort((a, b) => b.date_created - a.date_created)
        });

    }
    catch (error) {

        console.log(error);

        return res.status(200).json({
            status: "error",
            message: "Failed to get orders"
        });

    }

});

const deductAdmin = async (client, queryClient) => {

    try {

        await psql.query("BEGIN");

        const platformQuery = await psql.query({
            text: `SELECT amount FROM platform_commission WHERE access_key = 'fees' LIMIT 1`,
            values: []
        });

        const amount = parseFloat(platformQuery.rows[0].amount);

        if (amount == 0) {
            // do nothing
        }
        else {

            const hash = await client.writeContract({
                address: process.env.VAULT_ADDRESS,
                abi: VaultABI,
                functionName: "withdraw",
                account: client.account,
                args: [BigInt(amount), process.env.FEES_ADDRESS]
            });

            const receipt = await queryClient.waitForTransactionReceipt({ hash });

            if (receipt?.status == "success") {
                await psql.query({
                    text: `UPDATE platform_commission SET amount = amount - $1 WHERE access_key = 'fees'`,
                    values: [amount]
                });
                return true;
            }
            else {
                await psql.query("ROLLBACK");
                return false;
            }

        }

        await psql.query("COMMIT");

    }
    catch (error) {
        console.log(error);
        await psql.query("ROLLBACK");
    }

}

const batchWithdrawals = asyncHandler(async (req, res) => {

    try {

        const client = await getWalletClient();
        const queryClient = await getPublicClient();

        await deductAdmin(client, queryClient);

        let recordsToProcess = [];

        const batchSize = 250;

        await psql.query("BEGIN");

        const result = await psql.query({
            text: `SELECT 
            id, address, amount
            FROM withdrawals WHERE status = 'PENDING' 
            ORDER BY date_created DESC LIMIT $1 FOR UPDATE`,
            values: [batchSize]
        });

        recordsToProcess = result.rows;

        if (recordsToProcess.length == 0) {

            await psql.query("COMMIT");

            return res.status(200).json({
                status: "success",
                message: "No pending withdrawals found. Batch finished"
            });

        }

        const ids = recordsToProcess.map(r => r.id);

        await psql.query({
            text: `UPDATE withdrawals SET status = 'IN_BATCH' WHERE id = ANY($1::int[])`,
            values: [ids]
        });

        await psql.query("COMMIT");

        const accounts = recordsToProcess.map(r => r.address);
        const amounts = recordsToProcess.map(r => BigInt(r.amount));

        const hash = await client.writeContract({
            address: process.env.VAULT_ADDRESS,
            abi: VaultABI,
            functionName: "distribute",
            account: client.account,
            args: [accounts, amounts]
        });

        await psql.query({
            text: `UPDATE withdrawals SET tx_hash = $1 WHERE id = ANY($2::int[])`,
            values: [hash, ids]
        });

        const receipt = await queryClient.waitForTransactionReceipt({ hash });

        if (receipt?.status == "success") {

            const time = Math.floor(new Date().getTime() / 1000);

            await psql.query({
                text: `DELETE FROM withdrawals WHERE id = ANY($1::int[])`,
                values: [ids]
            });

            await psql.query({
                text: `INSERT INTO transaction_history (address, amount, txn_type, txhash, date_created) SELECT * FROM UNNEST($1::TEXT[], $2::NUMERIC[], $3::TEXT[], $4::TEXT[], $5::BIGINT[])`,
                values: [accounts, amounts, Array.from({ length: amounts.length }, () => 'WITHDRAWAL'), Array.from({ length: amounts.length }, () => hash), Array.from({ length: amounts.length }, () => time)]
            });

            return res.status(200).json({
                status: "success",
                message: "Withdrawals sent"
            });

        }
        else {
            await psql.query({
                text: `UPDATE withdrawals SET status = 'FAILED' where id = ANY($1::int[])`,
                values: [ids]
            });
            return res.status(200).json({
                status: "error",
                message: "Withdrawal failed"
            });
        }

    }
    catch (error) {

        if (psql) {

            try {

                const ids = recordsToProcess.map(r => r.id);

                if (ids.length > 0) {
                    await psql.query({
                        text: `UPDATE withdrawals SET status = 'PENDING' WHERE id = ANY($1::int[]) AND status = 'IN_BATCH'`,
                        values: [ids]
                    });
                }

                await psql.query("ROLLBACK");

            }
            catch (error) {
                console.log(error.message);
            }

        }

        return res.status(200).json({
            status: "error",
            message: "Failed to make batch withdrawals"
        });

    }

});

const getHistory = asyncHandler(async (req, res) => {

    const { transactionType = 'bets' } = req.params;

    const expectedTypes = { '0': 'order_history:0', '1': 'transaction_history:DEPOSIT', '2': 'transaction_history:WITHDRAWAL' };

    const { limit = 50, offset = 0 } = req.query;

    if (!expectedTypes.hasOwnProperty(transactionType)) {
        return res.status(200).json({
            status: "error",
            message: "Unexpected transaction type"
        });
    }

    const result = expectedTypes[transactionType].split(':');
    const table = result[0];
    const filter = result[1];

    let query;
    let params;

    const user = req.account;

    if (filter == '0') {
        query = `SELECT * FROM ${table} WHERE address = $1 ORDER BY date_created DESC LIMIT $2 OFFSET $3`;
        params = [user.address, limit, offset];
    }
    else {
        query = `SELECT amount, date_created, txhash FROM ${table} WHERE address = $1 AND txn_type = $2 ORDER BY date_created DESC LIMIT $3 OFFSET $4`;
        params = [user.address, filter, limit, offset];
    }

    const queryResult = await psql.query({
        text: query,
        values: params
    });

    if (limit > 100) {
        return res.status(200).json({
            status: "error",
            message: "Limit must be at most 100"
        });
    }

    const results = queryResult.rows.map(item => {

        item.amount = (parseFloat(item.amount) / 1e18);

        if (item.hasOwnProperty('trade_id')) {
            delete item['trade_id'];
        }
        if (item.hasOwnProperty('txn_type')) {
            delete item['txn_type'];
        }
        if (item.hasOwnProperty('winning_volume')) {

            item.winning_volume = parseFloat(item.winning_volume) / 1e18;
            item.losing_volume = parseFloat(item.losing_volume) / 1e18;

            let pnl = 0;

            if (item.market_resolution == null) {
                pnl = 'PENDING';
            }
            else {
                if (item.entry == item.market_resolution) {
                    if (item.losing_volume > 0) {
                        pnl = (item.amount / item.winning_volume) * item.losing_volume;
                    }
                    else {
                        pnl = 'REFUNDED';
                    }
                }
                else {
                    pnl = item.amount * -1;
                }
            }

            item.pnl = pnl;

        }

        item.date_created = parseFloat(item.date_created);

        if (item.hasOwnProperty('is_auto_trade')) {
            if (item.is_auto_trade == true) {
                item.isAutoTrade = true;
            }
            else {
                item.isAutoTrade = false;
            }
            delete item.is_auto_trade;
        }
        else {
            item.isAutoTrade = false;
        }

        return item;

    });

    const history = results;

    try {
        res.status(200).json({
            status: "success",
            history
        })
    }
    catch (error) {
        res.status(200).json({
            status: "error",
            message: "Failed to fetch transaction history"
        });
    }

});

module.exports = {
    withdraw,
    order,
    cancelAuto,
    getOrders,
    getEntryStatus,
    batchWithdrawals,
    getHistory
};