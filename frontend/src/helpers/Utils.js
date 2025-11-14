import CryptoJS from "crypto-js";
import { createPublicClient } from "viem";
import { bscTestnet } from "@reown/appkit/networks";
import { http } from "wagmi";

export const getImageUrl = (name) => {
    return new URL(`../assets/${name}`, import.meta.url).href;
}

//export const SERVER_ROOT = 'http://localhost:5000';
export const SERVER_ROOT = 'https://s.moonride.fun';

export const publicClient = createPublicClient({
    chain: bscTestnet,
    transport: http()
});

export const delayFor = (ms = 3000) => {
    return new Promise((resolve, _reject) => {
        setTimeout(() => {
            resolve(true);
        }, ms)
    });
}

export const COMMISSION = 0.05;

export const timeFormat = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const h = date.getHours().toString().padStart(2, '0');
    const i = date.getMinutes().toString().padStart(2, '0');
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}:${i}:${s}`;
}

export const dateFormat = (timestamp, locale = navigator.language) => {
    const date = new Date(timestamp * 1000);
    const datePart = date.toLocaleDateString(locale);
    const timePart = date.toLocaleTimeString(locale, { hour12: false });
    return `${datePart} ${timePart}`;
}

export const rankText = (rank) => {

    if (rank >= 11 && rank <= 13) {
        return `${rank.toLocaleString()}th`;
    }
    switch (rank % 10) {
        case 1:
            return `${rank.toLocaleString()}st`;
        case 2:
            return `${rank.toLocaleString()}nd`;
        case 3:
            return `${rank.toLocaleString()}rd`;
        default:
            return `${rank.toLocaleString()}th`;
    }

}

export const REFERRALS_CAP = 1000;

export const displayReferrals = (value) => {
    const maxStep = REFERRALS_CAP;
    const step = Math.min(Math.max(Math.ceil(value / 200) * 200, 200), maxStep);
    return {
        value: value,
        max: step,
        percentage: (value / step) * 100
    };
}

export const baseURL = () => {

    try {
        const { protocol, hostname, port } = window.location;
        if (!port) {
            return `${protocol}//${hostname}`;
        }
        return `${protocol}//${hostname}:${port}`;
    } catch (error) {
        return null;
    }

}

export const format = (address) => {

    let words = address.split("");
    let prefix = words.slice(0, 5);
    let suffix = words.slice(words.length - 5, words.length);

    return `${prefix.join("")}...${suffix.join("")}`;

}

export const formatNumber = (number) => {

    let num = parseFloat(number);

    if (num < 1000) return num.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
    });

    const absNum = Math.abs(num);
    const suffixes = [
        { value: 1e12, symbol: "T" },
        { value: 1e9, symbol: "B" },
        { value: 1e6, symbol: "M" },
        { value: 1e3, symbol: "k" }
    ];

    for (let { value, symbol } of suffixes) {
        if (absNum >= value) {
            let scaled = num / value;
            let formatted = scaled.toLocaleString(undefined, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 4,
            });
            return formatted + symbol;
        }
    }

}

export const dhms = (s) => {
    const fm = [
        Math.floor(s / 60 / 60 / 24), // DAYS
        Math.floor(s / 60 / 60) % 24, // HOURS
        Math.floor(s / 60) % 60, // MINUTES
        s % 60 // SECONDS
    ];
    return fm.map((v) => { return ((v < 10) ? '0' : '') + v; });
}