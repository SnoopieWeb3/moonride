import { Routes, Route, BrowserRouter } from "react-router-dom";

import "./App.css";
import "./pages/styles/style.css";
import "animate.css";
import 'swiper/css';

import Home from "./pages/Home";

import 'react-tooltip/dist/react-tooltip.css';
import "react-loading-skeleton/dist/skeleton.css";
import 'react-circular-progressbar/dist/styles.css';
import "react-multi-carousel/lib/styles.css";
import 'reactjs-popup/dist/index.css';

import { Toaster } from "sonner";

import { Tooltip } from 'react-tooltip';

import { createAppKit } from "@reown/appkit/react";

import { WagmiProvider } from "wagmi";
import { bscTestnet } from "@reown/appkit/networks";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

import { Web3Provider } from "./providers/Web3Provider";

import 'odometer/themes/odometer-theme-default.css';

const queryClient = new QueryClient();

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

const metadata = {
    name: "moonride.fun",
    description: `Ride on the market wave. Bet on UP or DOWN trends on BTC, SOL, and ETH to earn rewards!`,
    url: "https://moonride.fun",
    icons: ["https://moonride.fun/logo.png"],
};

const networks = [bscTestnet];

const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true
});

createAppKit({
    adapters: [wagmiAdapter],
    networks,
    defaultNetwork: bscTestnet,
    projectId,
    metadata,
    enableNetworkSwitch: false,
    enableWalletConnect: true,
    allWallets: "HIDE",
    featuredWalletIds: [
        "c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96", // Metamask
        "4622a2b2d6af1c9844944291e5e7351a6aa24cd7b23099efac1b2fd875da31a0", // Trust Wallet
        "971e689d0a5be527bac79629b4ee9b925e82208e5168b733496a09c0faed0709" // OKX Wallet
    ],
    features: {
        analytics: true,
        swaps: false,
        connectMethodsOrder: ["wallet"]
    }
});

function App() {
    return (
        <BrowserRouter>
            <WagmiProvider config={wagmiAdapter.wagmiConfig}>
                <QueryClientProvider client={queryClient}>
                    <Web3Provider>
                        <main className="#root">
                            <Routes>
                                <Route path="/:ref?/:refUsername?" element={<Home />} />
                            </Routes>
                            <Toaster
                                position="bottom-center"
                                duration={5000}
                                richColors={true}
                                theme="dark"
                                toastOptions={{
                                    className: 'sonner-toast'
                                }}
                                closeButton={true}
                            />
                            <Tooltip id="global-tooltip" place="top" className="tooltip-popup" />
                        </main>
                    </Web3Provider>
                </QueryClientProvider>
            </WagmiProvider>

        </BrowserRouter>
    );
}

export default App;