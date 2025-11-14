import React, { useEffect, useRef, useState } from 'react';

import { format, getImageUrl, SERVER_ROOT, dateFormat } from '../helpers/Utils';

import CryptoJS from 'crypto-js';

import { useProvider } from '../providers/Web3Provider';

import { toast } from 'sonner';
import Info from './Info';
import Modal from './Modal';

import { Swiper, SwiperSlide } from 'swiper/react';

const TransactionHistory = ({ }) => {

    const [showHistory, setShowHistory] = useState(false);

    const { authToken, web3Address } = useProvider();

    const [txnType, setTxnType] = useState(0);

    const [offset, setOffset] = useState(0);

    const historyRef = useRef(new Set());

    const [transactionHistory, setTransactionHistory] = useState([]);

    const [loading, setLoading] = useState(true);

    const LIMIT_SIZE = 25;

    const switchType = (index) => {
        setTxnType(index);
        historyRef.current = new Set();
        setTransactionHistory([]);
        setOffset(0);
    }

    const fetchHistory = async () => {

        try {

            const response = await fetch(`${SERVER_ROOT}/trading/${authToken}/history/${txnType}/get?limit=${LIMIT_SIZE}&offset=${offset}`, { method: 'GET' });

            if (response.ok) {
                const data = await response.json();
                const newItems = new Set(data?.history?.map(x => JSON.stringify(x)));
                const oldItems = historyRef.current;
                if (data.status == "success") {
                    for (let item of newItems) {
                        oldItems.add(item);
                    }
                    const result = [...oldItems].map(x => JSON.parse(x));
                    setTransactionHistory(result);
                    setLoading(false);
                }

            }
            else {
                let set = offset - LIMIT_SIZE;
                setOffset(set <= 0 ? 0 : set);
            }

        }
        catch (error) {
            let set = offset - LIMIT_SIZE;
            setOffset(set <= 0 ? 0 : set);
        }
    }

    const loadHistory = async (scroll = false) => {
        let _offset = offset;
        if (scroll == true) {
            _offset += LIMIT_SIZE;
        }
        setOffset(_offset);
    }

    useEffect(() => {
        if (web3Address != null) {
            if (authToken != '0') {
                fetchHistory();
            }
        }
    }, [offset, txnType, web3Address]);

    const openModal = async () => {
        historyRef.current = new Set();
        setTransactionHistory([]);
        setLoading(true);
        setTxnType(-1);
        setTimeout(() => {
            setTxnType(0);
            setOffset(0);
            setShowHistory(true);
        }, 500);
    }

    return (
        <>
            {showHistory == true ?
                <Modal title={'Transaction History'} isTransactionHistory={() => fetchHistory()} sub={''} close={() => setShowHistory(false)} width={'950px'} cannotHide={true} onScrollToBottom={() => loadHistory(true)}>
                    <div className='row my-5 align-items-center justify-content-center px-4'>
                        <div className='choose-txn-type'>
                            <Swiper
                                slidesPerView={'auto'}
                                spaceBetween={10}
                                loop={false}
                                freeMode={true}
                            >
                                <SwiperSlide onClick={() => { switchType(0) }} className={`txn-type ${txnType == 0 ? 'active' : ''}`}>
                                    Bets
                                </SwiperSlide>
                                <SwiperSlide onClick={() => { switchType(1) }} className={`txn-type ${txnType == 1 ? 'active' : ''}`}>
                                    Deposits
                                </SwiperSlide>
                                <SwiperSlide onClick={() => { switchType(2) }} className={`txn-type ${txnType == 2 ? 'active' : ''}`}>
                                    Withdrawals
                                </SwiperSlide>
                            </Swiper>
                        </div>
                    </div>
                    <div className='row pb-4'>
                        {loading == true ?
                            <></>
                            :
                            <div className='col-lg-12'>
                                {txnType == 0 ?
                                    <>
                                        <table className='w-100 px-4' cellSpacing={0} cellPadding={0}>
                                            <thead className='table-head'>
                                                <tr>
                                                    <td scope="col">Market</td>
                                                    <td scope="col">Entry</td>
                                                    <td scope="col">Stake</td>
                                                    <td scope="col">PnL</td>
                                                    <td scope="col">Date/Time</td>
                                                    <td scope="col"></td>
                                                </tr>
                                            </thead>
                                            <tbody className='table-body'>
                                                {transactionHistory?.map((value, _index) => {
                                                    return <tr key={value?.id}>
                                                        <td scope="row">
                                                            <div className='order-direction'>
                                                                <span className='gray-text'>{value?.symbol}</span>
                                                                <span className='table-mobile-titles ms-2'>MARKET</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className='order-direction'>
                                                                <span className='gray-text'>{value?.entry?.toUpperCase()}</span>
                                                                <span className='table-mobile-titles ms-2'>ENTRY</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className='order-direction'>
                                                                <img src={getImageUrl('coin.png')} className='coin-small me-2' />
                                                                <span>{value?.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                                                <span className='table-mobile-titles ms-2'>AMOUNT</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className='order-direction'>

                                                                {typeof value?.pnl == "string" ?
                                                                    <span className='red'>{value?.pnl}</span>
                                                                    :
                                                                    (value?.pnl > 0 ?
                                                                        <span className='green'>
                                                                            <img src={getImageUrl('coin.png')} className='coin-small me-2' /> +{value?.pnl?.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                                                        </span>
                                                                        :
                                                                        <span className='red'>
                                                                            <img src={getImageUrl('coin.png')} className='coin-small me-2' /> {value?.pnl?.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                                                        </span>)}

                                                                <span className='table-mobile-titles ms-2'>PNL</span>

                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className='order-direction'>
                                                                <span className="gray-text">{dateFormat(value.date_created || 0)}</span>
                                                                <span className='table-mobile-titles ms-2'>DATE/TIME</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className='order-direction'>
                                                                {value?.isAutoTrade == true ?
                                                                    <div className='chat-index px-3 bot' data-tooltip-id='global-tooltip' data-tooltip-content='Bet was executed via an auto-stake bot'>
                                                                        <img src={getImageUrl('bot-click.png')} className='clicks me-2' />
                                                                        <span>Auto-Stake</span>
                                                                    </div> :
                                                                    <div className='chat-index px-2' data-tooltip-id='global-tooltip' data-tooltip-content='Bet was executed via one-time stake'>
                                                                        <img src={getImageUrl('human-click.png')} className='clicks me-2' />
                                                                        <span>One-Time</span>
                                                                    </div>
                                                                }
                                                                <span className='table-mobile-titles ms-2'>STAKE TYPE</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                })}
                                                {loading == false && transactionHistory?.length == 0 ?
                                                    <tr>
                                                        <td colSpan="6" className='gray-text history-column'>
                                                            <center>... ...</center>
                                                        </td>
                                                    </tr> :
                                                    null
                                                }
                                            </tbody>
                                        </table>
                                    </>
                                    : null
                                }

                                {txnType == 1 || txnType == 2 ?
                                    <>
                                        <table className='w-100 px-4' cellSpacing={0} cellPadding={0}>
                                            <thead className='table-head'>
                                                <tr>
                                                    <td scope="col">Amount</td>
                                                    <td scope="col">Txn. Hash</td>
                                                    <td scope="col">Date/Time</td>
                                                </tr>
                                            </thead>
                                            <tbody className='table-body'>
                                                {transactionHistory?.map((value, _index) => {
                                                    return <tr key={value?.id}>
                                                        <td scope="row">
                                                            <div className='order-direction'>
                                                                <img src={getImageUrl('coin.png')} className='coin-small me-2' />
                                                                <span>{value?.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                                                <span className='table-mobile-titles ms-2'>AMOUNT</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className='order-direction'>
                                                                <span className="gray-text">{format(value?.txhash || '')}</span>
                                                                <span className='table-mobile-titles ms-2'>TXN. HASH</span>
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className='order-direction'>
                                                                <span className='gray-text'>{dateFormat(value?.date_created || 0)}</span>
                                                                <span className='table-mobile-titles ms-2'>DATE/TIME</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                })}
                                                {loading == false && transactionHistory?.length == 0 ?
                                                    <tr>
                                                        <td colSpan="3" className='gray-text history-column'>
                                                            <center>... ...</center>
                                                        </td>
                                                    </tr> :
                                                    null
                                                }
                                            </tbody>
                                        </table>
                                    </>
                                    : null
                                }
                            </div>
                        }
                    </div>
                </Modal> : null
            }
            <div data-tooltip-id='global-tooltip' data-tooltip-content={'Transaction history'} className='d-flex align-items-center justify-content-between px-0 my-1' onClick={() => openModal()}>
                <img src={getImageUrl('history-icon.png')} className='me-2 small-icon' />
            </div>
        </>
    );
};

export default TransactionHistory;