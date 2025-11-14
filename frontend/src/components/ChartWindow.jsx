import React, { useRef, useEffect, useState } from 'react';

import { Line } from 'react-chartjs-2';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
    TimeScale
} from 'chart.js';

import annotationPlugin from 'chartjs-plugin-annotation';

import 'chartjs-adapter-date-fns';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
    TimeScale,
    annotationPlugin
);

ChartJS.defaults.font.family = '"Avenue Mono", sans-serif';

const createGradient = (ctx, area, direction) => {
    const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top);
    if (direction == "DOWN") {
        gradient.addColorStop(0, 'rgba(255, 30, 0, 0)');
        gradient.addColorStop(1, 'rgba(255, 30, 0, 0.4)');
    }
    else {
        gradient.addColorStop(0, 'rgba(0, 255, 115, 0)');
        gradient.addColorStop(1, 'rgba(0, 255, 115, 0.4)');
    }
    return gradient;
}

const ChartWindow = React.memo(({ data }) => {
    const chartRef = useRef(null);
    const [chartGradient, setChartGradient] = useState(null);

    useEffect(() => {
        if (chartRef.current) {
            const chart = chartRef.current;
            const ctx = chart.ctx;
            const gradient = createGradient(ctx, chart.chartArea, data.direction);
            setChartGradient(gradient);
        }
    }, [data]);

    const chartData = {
        labels: data.timestamps,
        datasets: [
            {
                label: ``,
                data: data.prices,
                fill: true,
                backgroundColor: chartGradient,
                borderColor: (data.direction == 'DOWN') ? '#FF1E00' : '#00FF73',
                borderWidth: 2,
                tension: 0.1,
                pointRadius: (context) => {
                    const index = context.dataIndex;
                    const dataLength = context.chart.data.datasets[0].data.length;
                    return index === dataLength - 1 ? 5 : 0;
                },
                pointBackgroundColor: '#625AFC',
                pointBorderColor: (data.direction == 'DOWN') ? '#FF1E00' : '#00FF73',
            }
        ]
    };

    const firstPrice = data.prices.length > 0 ? data.prices[0] : null;
    const lastPrice = data.prices.length > 0 ? data.prices[data.prices.length - 1] : null;

    const formatPriceLabel = (price) => {
        return price !== null ? `$${parseFloat(price.toFixed(4)).toLocaleString()}` : '';
    };

    const chartOptions = {
        animation: {
            duration: 800,
            easing: "easeOutQuart"
        },
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                display: false,
                type: 'time',
                title: {
                    display: false,
                },
                ticks: {
                    color: '#ffffff',
                    font: {
                        size: 10
                    },
                    padding: 15,
                    minRotation: 30,
                    maxRotation: 90
                },
                grid: {
                    display: false,
                    drawTicks: false
                },
                border: {
                    display: false
                }
            },
            y: {
                position: 'left',
                title: {
                    display: false,
                },
                ticks: {
                    color: '#ffffff',
                    font: {
                        size: 11
                    },
                    padding: 10
                },
                grid: {
                    display: true,
                    drawTicks: false,
                    color: '#2B3130'
                },
                border: {
                    display: false
                }
            }
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    title: () => {
                        return ''
                    },
                    label: (tooltipItem) => {
                        return ` $${parseFloat(tooltipItem.parsed.y.toFixed(4)).toLocaleString()} `;
                    }
                }
            },
            annotation: {
                annotations: {
                    firstPointLine: {
                        type: 'line',
                        yMin: firstPrice,
                        yMax: firstPrice,
                        borderColor: '#A9A9A9',
                        borderDash: [5, 5],
                        display: (data.prices.length == 0) ? false : true,
                        label: {
                            content: formatPriceLabel(firstPrice),
                            display: true,
                            position: 'start',
                            backgroundColor: '#000000',
                            color: 'white',
                            borderRadius: 20,
                            padding: {
                                top: 5,
                                right: 20,
                                bottom: 5,
                                left: 20
                            },
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    },
                    lastPointLine: {
                        type: 'line',
                        yMin: lastPrice,
                        yMax: lastPrice,
                        borderDash: [5, 5],
                        display: (data.prices.length == 0) ? false : true,
                        label: {
                            content: formatPriceLabel(lastPrice),
                            display: true,
                            position: 'end',
                            backgroundColor: '#FFFFFF',
                            color: '#000000',
                            borderRadius: 20,
                            padding: {
                                top: 5,
                                right: 20,
                                bottom: 5,
                                left: 20
                            },
                            font: {
                                size: 12,
                                weight: 'bold'
                            }
                        }
                    }
                }
            }
        }
    };

    return (
        <div className={'chart-div pt-3 dark-bg'}>
            <Line
                ref={chartRef}
                options={chartOptions}
                data={chartData}
            />
        </div>
    );
});

export default ChartWindow;