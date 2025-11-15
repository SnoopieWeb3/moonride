const psql = require("../database/connection");

const getTimestamp = () => {
    return Math.floor(new Date().getTime() / 1000);
}

const randomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

const bscTestnetWss = 'wss://bsc-testnet-rpc.publicnode.com';

const getPublicClient = async () => {

    const { createPublicClient, webSocket } = await import("viem");
    const { bscTestnet } = await import("viem/chains");

    const publicClient = createPublicClient({
        chain: bscTestnet,
        transport: webSocket(bscTestnetWss, {
            reconnect: true
        }),
    });

    return publicClient;

}

const delayFor = async (ms=5000) => {
    return new Promise((resolve, _reject) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

const getWalletClient = async () => {

    const { createWalletClient, webSocket } = await import("viem");
    const { bscTestnet } = await import("viem/chains");
    const { privateKeyToAccount } = await import("viem/accounts");

    const account = privateKeyToAccount(`0x${process.env.PRIVATE_KEY}`);

    const walletClient = createWalletClient({
        account,
        chain: bscTestnet,
        transport: webSocket(bscTestnetWss, {
            reconnect: true
        }),
    });

    return walletClient;

}

const pointsDistribution = {
    forWins: 25,
    forTrades: 3,
    forDeposits: 2,
    forSharing: 6,
    forReferral: 10,
    forChats: 5
};

const REFERRALS_CAP = 1000;

const metadataURL = `https://localhost:5173`;

const COMMISSION = 0.05;

const SECONDS_IN_A_WEEK = 604800;

const getRewardsProgression = (price) => {

    const start = 5;

    const length = 10;

    const difference = 5;

    const result = [];

    for (let i = 0; i < length; i++) {
        result.push(start + i * difference);
    }

    result.reverse();

    const rewards = result.map((x) => Math.floor(x) / price);

    return rewards;

}

const formatAddress = (address) => {

    let words = address.split("");
    let prefix = words.slice(0, 5);
    let suffix = words.slice(words.length - 5, words.length);

    return `${prefix.join("")}...${suffix.join("")}`;

}

module.exports = {
    getTimestamp,
    randomInt,
    getPublicClient,
    getWalletClient,
    getRewardsProgression,
    formatAddress,
    pointsDistribution,
    COMMISSION,
    SECONDS_IN_A_WEEK,
    metadataURL,
    REFERRALS_CAP,
    delayFor
}