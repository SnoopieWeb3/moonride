import { useEffect, useRef } from 'react';

const TradingViewTickerTape = ({ symbols }) => {

    const containerRef = useRef();

    useEffect(() => {

        const script = document.createElement('script');

        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';

        script.async = true;

        script.innerHTML = JSON.stringify({
            symbols: symbols.map(symbol => {
                return { proName: `BINANCE:${symbol}USDT`, title: symbol };
            }),
            colorTheme: "dark",
            isTransparent: true,
            displayMode: "regular",
            showSymbolLogo: true,
            locale: "en"
        });

        containerRef.current.appendChild(script);

        return () => {

            if (containerRef.current) {

                containerRef.current.innerHTML = '';

            }

        };

    }, []);

    return (
        <div
            style={{
                overflow: 'hidden',
                maxWidth: '100%'
            }}
        >
            <div className="tradingview-widget-container" ref={containerRef}>
            </div>
        </div>
    );
};

export default TradingViewTickerTape;