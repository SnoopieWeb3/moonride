const symbolColors = [
    "#CD904B",
    "#9B528D",
    "#1A2640",
    //"#3F754B"
];

const marketStore = {

    markets: {},

    namespaces: {},

    trades: {},

    volumes: {},

    symbols: [
        "BTC",
        "SOL",
        "ETH",
        //"BNB"
    ],

    colors: {},

    emojis: [
        {
            id: "pepe",
            noobUnlocked: true
        },
        {
            id: "gm-abs",
            noobUnlocked: true,
        },
        {
            id: "gm",
            noobUnlocked: true
        },
        {
            id: "pump-chart",
            noobUnlocked: false
        },
        {
            id: "gn",
            noobUnlocked: true
        },
        {
            id: "thanks",
            noobUnlocked: true
        },
        {
            id: "loading",
            noobUnlocked: false
        },
        {
            id: "yes-no",
            noobUnlocked: false
        },
        {
            id: "hahaha",
            noobUnlocked: false
        },
        {
            id: "robot-dance",
            noobUnlocked: true
        },
        {
            id: "congratulations",
            noobUnlocked: true
        },
        {
            id: "wink",
            noobUnlocked: false
        },
        {
            id: "punch-knuckle",
            noobUnlocked: false
        },
        {
            id: "wave",
            noobUnlocked: false
        },
        {
            id: "kuromi-angry",
            noobUnlocked: false
        },
        {
            id: "wake-up",
            noobUnlocked: true
        },
        {
            id: "show-bitcoin",
            noobUnlocked: false
        },
        {
            id: "wow",
            noobUnlocked: false
        },
        {
            id: "alice",
            noobUnlocked: false
        },
        {
            id: "bags-bitcoin",
            noobUnlocked: false
        },
        {
            id: "bullish",
            noobUnlocked: false
        },
        {
            id: "pump-it",
            noobUnlocked: false
        },
        {
            id: "potz-reee",
            noobUnlocked: false
        }
    ]
};

for (let i = 0; i < symbolColors.length; i++) {
    marketStore.colors[marketStore.symbols[i]] = symbolColors[i];
}

module.exports = marketStore;