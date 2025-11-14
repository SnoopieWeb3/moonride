const psql = require("../database/connection")
const { SECONDS_IN_A_WEEK } = require("./utils")

const migrations = async (symbols) => {

    const autoTrading = {};

    for (let symbol of symbols) {

        autoTrading[symbol] = {
            enabled: false,
            configurations: {}
        };

    }

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS accounts (
                id BIGSERIAL PRIMARY KEY,
                address TEXT NOT NULL,
                username TEXT NOT NULL UNIQUE,
                token TEXT NOT NULL,
                balance NUMERIC (78, 0) NOT NULL DEFAULT 0,
                points BIGINT NOT NULL DEFAULT 0,
                leaderboard_points BIGINT NOT NULL DEFAULT 0,
                auto_trading JSONB NOT NULL DEFAULT '${JSON.stringify(autoTrading)}'::JSONB,
                referrals_count BIGINT NOT NULL DEFAULT 0,
                pnl DOUBLE PRECISION NOT NULL DEFAULT 0,
                date_created BIGINT NOT NULL,
                UNIQUE (address, token, username)
            )
        `,
        values: []
    });

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS market_state (
                id BIGSERIAL PRIMARY KEY,
                symbol TEXT UNIQUE NOT NULL,
                entries JSONB
            )
        `,
        values: []
    });

    for (let symbol of symbols) {
        await psql.query({
            text: `INSERT INTO market_state (symbol, entries) VALUES ($1, $2) ON CONFLICT (symbol) DO NOTHING`,
            values: [
                symbol,
                JSON.stringify({
                    roundPrices: [],
                    roundIndex: 0,
                    counter: 0,
                    state: 0,
                    price: 0,
                    roundStartPrice: 0,
                    roundEndPrice: 0,
                    outcomes: [],
                    direction: null,
                    bullishCount: 0,
                    bearishCount: 0
                })
            ]
        });
    }


    const time = Math.floor(new Date().getTime() / 1000)

    await psql.query({
        text: `INSERT INTO market_state (symbol, entries) VALUES ($1, $2) ON CONFLICT (symbol) DO NOTHING`,
        values: [
            'leaderboard',
            JSON.stringify({
                startTime: time,
                endTime: time + SECONDS_IN_A_WEEK // +1 Week
            })
        ]
    });

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS trades (
                id BIGSERIAL PRIMARY KEY,
                address TEXT NOT NULL,
                symbol TEXT NOT NULL,
                amount NUMERIC (78, 0) NOT NULL,
                round BIGINT NOT NULL,
                entry TEXT NOT NULL,
                date_created BIGINT NOT NULL,
                UNIQUE (address, symbol)
            )
        `,
        values: []
    });

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS order_history (
                id BIGSERIAL PRIMARY KEY,
                trade_id BIGINT NOT NULL,
                address TEXT NOT NULL,
                symbol TEXT NOT NULL,
                amount NUMERIC (78, 0) NOT NULL,
                round BIGINT NOT NULL,
                entry TEXT NOT NULL,
                is_auto_trade BOOLEAN NOT NULL,
                date_created BIGINT NOT NULL,
                winning_volume NUMERIC(78, 0) NOT NULL DEFAULT 0,
                losing_volume NUMERIC(78, 0) NOT NULL DEFAULT 0,
                market_resolution TEXT,
                UNIQUE (address, symbol, round, entry)
            )
        `,
        values: []
    });

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS win_shares (
                id BIGSERIAL PRIMARY KEY,
                outcome_index TEXT NOT NULL,
                address TEXT NOT NULL,
                symbol TEXT NOT NULL,
                stake NUMERIC (78, 0) NOT NULL,
                won NUMERIC (78, 0) NOT NULL,
                round BIGINT NOT NULL,
                direction TEXT NOT NULL,
                date_created BIGINT NOT NULL,
                UNIQUE (address, symbol, round)
            )
        `,
        values: []
    });

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS platform_commission (
                id BIGSERIAL PRIMARY KEY,
                access_key TEXT UNIQUE NOT NULL,
                amount NUMERIC (78, 0) NOT NULL
            )
        `,
        values: []
    });

    await psql.query({
        text: `INSERT INTO platform_commission (access_key, amount) VALUES ($1, $2) ON CONFLICT (access_key) DO NOTHING`,
        values: ['fees', 0]
    });

    await psql.query({
        text: `INSERT INTO platform_commission (access_key, amount) VALUES ($1, $2) ON CONFLICT (access_key) DO NOTHING`,
        values: ['volume', 0]
    });

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS withdrawals (
                id BIGSERIAL PRIMARY KEY,
                address TEXT NOT NULL,
                amount NUMERIC (78, 0) NOT NULL,
                status TEXT NOT NULL DEFAULT 'PENDING',
                tx_hash TEXT,
                date_created BIGINT NOT NULL,
                CONSTRAINT valid_status CHECK (
                    status IN ('PENDING', 'IN_BATCH', 'COMPLETED', 'FAILED')
                )
            )
        `,
        values: []
    });

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS transaction_history (
                id BIGSERIAL PRIMARY KEY,
                address TEXT NOT NULL,
                amount NUMERIC (78, 0) NOT NULL,
                txn_type TEXT NOT NULL,
                txhash TEXT NOT NULL UNIQUE,
                date_created BIGINT NOT NULL,
                CONSTRAINT valid_status CHECK (
                    txn_type IN ('DEPOSIT', 'WITHDRAWAL')
                )
            )
        `,
        values: []
    })

    await psql.query({
        text: `
            CREATE TABLE IF NOT EXISTS ads (
                id BIGSERIAL PRIMARY KEY,
                media TEXT NOT NULL,
                url TEXT NOT NULL,
                date_created BIGINT NOT NULL
            )
        `,
        values: []
    });

    const indexes = [

        'CREATE INDEX IF NOT EXISTS idx_points ON accounts (points DESC)',
        'CREATE INDEX IF NOT EXISTS idx_username ON accounts (username)',
        'CREATE INDEX IF NOT EXISTS idx_address ON accounts (address)',
        'CREATE INDEX IF NOT EXISTS idx_token ON accounts (token)',
        'CREATE INDEX IF NOT EXISTS idx_leaderboard_points ON accounts (leaderboard_points DESC)',
        'CREATE INDEX IF NOT EXISTS idx_auto_trading ON accounts USING gin (auto_trading)',
        'CREATE INDEX IF NOT EXISTS idx_date_created ON accounts (date_created)',
        'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_active_accounts ON accounts (address) WHERE balance > 0',

        'CREATE INDEX IF NOT EXISTS idx_round ON trades (round)',
        'CREATE INDEX IF NOT EXISTS idx_address ON trades (address)',
        'CREATE INDEX IF NOT EXISTS idx_entry ON trades (entry)',
        'CREATE INDEX IF NOT EXISTS idx_address_symbol ON trades (address, symbol)',
        'CREATE INDEX IF NOT EXISTS idx_date_created ON trades (date_created DESC)',

        'CREATE INDEX IF NOT EXISTS idx_address ON withdrawals (address)',
        'CREATE INDEX IF NOT EXISTS idx_date_created ON withdrawals (date_created DESC)',
        'CREATE INDEX IF NOT EXISTS idx_status ON withdrawals (status)',

        'CREATE INDEX IF NOT EXISTS idx_date_created ON ads (date_created DESC)',

        'CREATE INDEX IF NOT EXISTS idx_trade_id ON order_history (trade_id)',
        'CREATE INDEX IF NOT EXISTS idx_address ON order_history (address)',
        'CREATE INDEX IF NOT EXISTS idx_symbol_round ON order_history (symbol, round)',
        'CREATE INDEX IF NOT EXISTS idx_date_created ON order_history (date_created DESC)'

    ];

    for (let index of indexes) {
        await psql.query({
            text: index,
            values: [],
        });
    }

};

module.exports = {
    migrations
}