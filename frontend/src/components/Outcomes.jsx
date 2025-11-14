import { useEffect, useState } from 'react';

import { COMMISSION, getImageUrl, SERVER_ROOT } from '../helpers/Utils';

import { useProvider } from '../providers/Web3Provider';

const Outcomes = ({ data, market }) => {

    const marketSymbol = market?.toLowerCase();

    const [loaded, setLoaded] = useState(false);

    const { authToken } = useProvider();

    const states = {
        'won': ['cashout-won.png', 'YOU WON!', data.system.direction.toUpperCase()],
        'lost': ['cashout-lost.png', 'YOU LOST', data.system.direction.toUpperCase()],
        'refunded': ['cashout-refunded.png', 'REFUNDED', 'Annulled']
    };

    const [resultOutput, setResultOutput] = useState({});

    const [outcomeImageIndex, setOutcomeImageIndex] = useState(null);

    const handleResult = (index) => {

        let userStake = 0;

        let amountWon = 0;

        let pnl = {
            value: 0,
            percent: 0,
        };

        if (index == 'won') {

            userStake = data.user?.[marketSymbol].stake || 0;
            const losingPool = data.system.losingVolume - (COMMISSION * data.system.losingVolume);
            const ratio = (userStake / data.system.winningVolume) * losingPool;

            pnl = {
                value: ratio,
                percent: (ratio / userStake) * 100
            };

            amountWon = ratio;

        }
        else if (index == 'lost') {

            userStake = data.user?.[marketSymbol].stake || 0;

            pnl = {
                value: userStake * -1,
                percent: -100
            };

        }
        else if (index == "refunded") {

            userStake = data.user?.[marketSymbol].stake || 0;

        }

        const output = {
            index,
            amountWon,
            userDirection: data.user?.[marketSymbol].direction?.toUpperCase(),
            stake: userStake,
            symbol: marketSymbol?.toUpperCase(),
            resolution: states[index][2],
            pnl,
            round: data.user?.[marketSymbol].round
        };

        setResultOutput(output);

    }

    useEffect(() => {

        (async () => {

            let outcomeIndex = null;

            if (data.system.direction != data.user?.[marketSymbol]?.direction || data.system.direction == "mid") {
                outcomeIndex = 'lost';
            }
            else {
                if (data.system.reason == "winners_distribution") {
                    outcomeIndex = 'won';
                }
                else {
                    outcomeIndex = 'refunded';
                }
            }

            setOutcomeImageIndex(outcomeIndex);

            handleResult(outcomeIndex);

            setLoaded(true);

        })();

    }, []);

    const share = async () => {

        try {

            const response = await fetch(`${SERVER_ROOT}/share/${authToken}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: resultOutput
                }),
            });

            if (!response.ok) {
                toast.error('Failed to generate share URL. Please try again!');
            }
            else {

                const data = await response.json();

                if (data.status == "success") {
                    const text = 'Hey guys! I just played a game on @moonridedotfun.\n\nYou should check them out!\n\n';
                    open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(data.url)}`);
                }
                else {
                    toast.error(data.message);
                }

            }

        }
        catch (error) {
            toast.error('Failed to generate share URL. Please try again!');
        }

    }

    return (

        <>

            <div className='outcome-media'>

                {loaded == false ?
                    null :
                    <>
                        <img src={getImageUrl(states[outcomeImageIndex][0])} className='outcome-img' />
                    </>
                }

            </div>

            {loaded == false ?
                null :
                <>
                    <div className='outcome-body px-3'>
                        <center>
                            <div className={`outcome-result my-3 ${outcomeImageIndex == 'won' ? '' : 'margin-outcome-bottom'}`}>{states[outcomeImageIndex][1]}</div>
                            {outcomeImageIndex == 'won' ?
                                <div className='outcome-won'>
                                    <img src={getImageUrl('coin.png')} className='outcome-coin me-2' />
                                    <span>{resultOutput.amountWon.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                </div>
                                : null
                            }
                            <div className='my-2'>
                                <div className='my-3 row justify-content-between align-items-center'>
                                    <div className='col-auto'>
                                        <span className='outcome-item-title'>Order</span>
                                    </div>
                                    <div className='col-auto'>
                                        <span className='outcome-item-content'>
                                            {resultOutput.userDirection}
                                        </span>
                                    </div>
                                </div>
                                <div className='my-3 row justify-content-between align-items-center'>
                                    <div className='col-auto'>
                                        <span className='outcome-item-title'>Stake</span>
                                    </div>
                                    <div className='col-auto'>
                                        <div className='outcome-item-content'>
                                            <img src={getImageUrl('coin.png')} className='coin-small mx-2 ms-3' />
                                            <span className='text-white'>{resultOutput.stake.toLocaleString(undefined, { maximumFractionDigits: 6 })}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className='my-3 row justify-content-between align-items-center'>
                                    <div className='col-auto'>
                                        <span className='outcome-item-title'>Resolution</span>
                                    </div>
                                    <div className='col-auto'>
                                        <span className='outcome-item-content'>
                                            {resultOutput.resolution}
                                        </span>
                                    </div>
                                </div>
                                <div className='my-3 row justify-content-between align-items-center'>
                                    <div className='col-auto'>
                                        <span className='outcome-item-title'>PnL</span>
                                    </div>
                                    <div className='col-auto'>
                                        {outcomeImageIndex != 'refunded' ?
                                            <span className='outcome-item-content'>
                                                <span className={`entry-pnl ${resultOutput.pnl?.value > 0 ? 'green' : 'red'}`}>
                                                    <div className='px-1'>{resultOutput.pnl?.value > 0 ? '+' : ''}{resultOutput.pnl?.value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                                                    <div>({resultOutput.pnl?.value > 0 ? '+' : ''}{resultOutput.pnl?.percent.toLocaleString(undefined, { maximumFractionDigits: 4 })}%)</div>
                                                </span>
                                            </span>
                                            :
                                            <span className='outcome-item-content'>--</span>
                                        }
                                    </div>
                                </div>
                                <div className='my-3 row justify-content-between align-items-center'>
                                    <div className='col-auto'>
                                        <span className='outcome-item-title'>Draw ID</span>
                                    </div>
                                    <div className='col-auto'>
                                        <span className='outcome-item-content'>
                                            #{resultOutput.round}
                                        </span>
                                    </div>
                                </div>
                                <div className='my-4'>
                                    <center>
                                        <button className='share my-2 mb-0' onClick={() => share()}>
                                            <img src={getImageUrl('x-share.png')} className='x-share me-1' />
                                            <span>Share on X</span>
                                        </button>
                                    </center>
                                </div>
                            </div>
                        </center>
                    </div>
                </>
            }

        </>

    );
};

export default Outcomes;