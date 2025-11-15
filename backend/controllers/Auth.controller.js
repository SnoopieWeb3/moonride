const asyncHandler = require("express-async-handler");
const psql = require("../database/connection");

const { ethers } = require("ethers");

const { loadRankings, generateBadge } = require("../lib/helpers");

const { uniqueUsernameGenerator, adjectives, nouns } = require('unique-username-generator');
const { pointsDistribution, REFERRALS_CAP } = require("../lib/utils");

const register = asyncHandler(async (req, res) => {

    const {
        token = null,
        address = null
    } = req.body;

    const {
        refCode = null
    } = req.params;

    const referralCode = refCode?.trim() || null;

    try {

        const time = Math.floor(new Date().getTime() / 1000);

        let account;

        if (token == null || address == null) {
            return res.status(401).json({
                status: "error",
                message: "A valid address and auth token must be provided"
            });
        }

        const recoveredAddress = ethers.verifyMessage(JSON.stringify({ address }), token);

        if (recoveredAddress.toLowerCase() != address.toLowerCase()) {
            return res.status(401).json({
                status: "error",
                message: "Invalid auth token provided"
            });
        }

        const exists = await psql.query({
            text: `SELECT * FROM accounts WHERE address = $1 AND token = $2 LIMIT 1`,
            values: [address, token]
        });

        try {

            await psql.query('BEGIN');

            if (exists.rows.length == 0) {

                let isUnique = false;
                let username;

                while (!isUnique) {
                    username = uniqueUsernameGenerator({ style: 'snakeCase', dictionaries: [adjectives, nouns] });
                    const query = await psql.query({
                        text: 'SELECT * FROM accounts WHERE username = $1 LIMIT 1',
                        values: [username]
                    });
                    isUnique = query.rows.length === 0;
                }

                await psql.query({
                    text: `INSERT INTO accounts (address, username, token, date_created) VALUES ($1, $2, $3, $4) ON CONFLICT (address, token, username) DO NOTHING`,
                    values: [address, username, token, time]
                });

                account = {
                    address,
                    username
                };

            }

            else {

                const user = exists.rows[0];

                account = {
                    address: user.address,
                    username: user.username
                };

            }

            await psql.query('COMMIT');

        }
        catch (error) {
            await psql.query('ROLLBACK');
            throw error;
        }

        try {

            if (exists.rows.length == 0) {

                if (referralCode != null) {
                    await psql.query({
                        text: `UPDATE accounts SET points = points + $1, leaderboard_points = leaderboard_points + $1, referrals_count = referrals_count + 1 WHERE username = $2 AND referrals_count < $3`,
                        values: [pointsDistribution.forReferral, referralCode, REFERRALS_CAP]
                    });
                }

            }

        }
        catch (error) { }

        return res.status(200).json({
            status: "success",
            message: "User registered successfully",
            account
        });

    }
    catch (error) {

        console.log(error);

        return res.status(401).json({
            status: "error",
            message: "Failed to register user"
        });

    }

});


const editUsername = asyncHandler(async (req, res) => {

    const {
        username = ''
    } = req.body;

    try {

        const user = req.account;

        const regex = /^[a-z][a-z0-9_]{2,24}$/;

        const error = "Username must be alphanumeric and contain only underscores";

        if (username?.trim() == '') {
            return res.status(200).json({
                status: "error",
                message: error
            });
        }

        if (!regex.test(username)) {
            return res.status(200).json({
                status: "error",
                message: error
            });
        }

        const usernameToUpdate = username.trim().toLowerCase();

        const exists = await psql.query({
            text: `SELECT * FROM accounts WHERE username = $1 LIMIT 1`,
            values: [usernameToUpdate]
        });

        if (exists.rows.length > 0) {
            return res.status(200).json({
                status: "error",
                message: "Username already in use!"
            });
        }

        await psql.query({
            text: `UPDATE accounts SET username = $1 WHERE address = $2`,
            values: [usernameToUpdate, user.address]
        });

        return res.status(200).json({
            status: "success",
            message: "Username updated successfully"
        });

    }
    catch (error) {

        console.log(error);

        return res.status(401).json({
            status: "error",
            message: "Failed to update username"
        });

    }

});

const getProfile = asyncHandler(async (req, res) => {

    try {

        const user = req.account;

        const account = {
            address: user.address,
            username: user.username,
            balance: parseFloat(user.balance) / 1e18,
            points: parseFloat(user.leaderboard_points),
            referrals: parseFloat(user.referrals_count),
            badge: generateBadge(parseFloat(user.points))
        };

        return res.status(200).json({
            status: "success",
            account
        });

    }
    catch (error) {

        console.log(error);

        return res.status(401).json({
            status: "error",
            message: "Failed to query user"
        });

    }

});


const getLeaderboard = asyncHandler(async (req, res) => {

    try {

        const marketStore = req.app.locals.marketStore;

        const { token = '0', symbol = null } = req.params;

        const marketSymbol = symbol?.toUpperCase() || null;

        if (!marketStore?.markets.hasOwnProperty(marketSymbol)) {
            return res.status(200).json({
                status: "error",
                message: "Market symbol must be associated with a registered market"
            });
        }

        const leaderboard = await loadRankings(marketStore);

        let userRank = null;

        let account;

        const userQuery = await psql.query({
            text: `SELECT * FROM accounts WHERE token = $1 LIMIT 1`,
            values: [token]
        });

        if (userQuery.rows.length > 0) {
            account = userQuery.rows[0].address;
        }

        if (account) {

            const userQueryText = `
                WITH ranked_users AS (
                    SELECT
                        address,
                        leaderboard_points,
                        username,
                        pnl,
                        points,
                        ROW_NUMBER() OVER (ORDER BY leaderboard_points DESC, points DESC) AS rank
                    FROM accounts
                )
                SELECT * FROM ranked_users WHERE address = $1
            `;

            const { rows: userRows } = await psql.query({
                text: userQueryText,
                values: [account]
            });

            if (userRows.length > 0) {
                const user = userRows[0];
                const rank = parseFloat(user.rank);
                userRank = {
                    address: user.address,
                    points: parseFloat(user.leaderboard_points),
                    username: user.username,
                    pnl: parseFloat(user.pnl) / 1e18,
                    rank,
                    reward: marketStore.markets?.[marketSymbol]?.rewardsDistribution?.[rank] || 0,
                    badge: generateBadge(parseFloat(user.points))
                };
            }

        }

        return res.status(200).json({
            status: "success",
            leaderboard,
            userRank
        });

    } catch (error) {
        console.error("Error getting leaderboard:", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to get leaderboard due to a server error."
        });
    }

});

const getAds = asyncHandler(async (req, res) => {

    try {

        const adsQuery = await psql.query({
            text: `SELECT * FROM ads ORDER BY RANDOM() LIMIT 10`
        });

        return res.status(200).json({
            status: "success",
            ads: adsQuery.rows
        });

    } catch (error) {
        console.error("Error getting ads", error);
        return res.status(500).json({
            status: "error",
            message: "Failed to query ads"
        });
    }

});

module.exports = {
    register,
    editUsername,
    getProfile,
    getLeaderboard,
    getAds
};