import React, { useEffect, useRef, useState } from 'react';

import { delayFor, formatNumber, getImageUrl, SERVER_ROOT, format, dhms, baseURL, displayReferrals, rankText } from '../helpers/Utils';

import CryptoJS from 'crypto-js';

import { useProvider } from '../providers/Web3Provider';
import Socials from './Socials';

import { toast } from 'sonner';
import Info from './Info';

const LeaderboardItem = React.memo(({ data }) => {

    const { web3Address = null } = useProvider();

    return (<tr>
        <td scope='row' className={`${data.address == web3Address ? 'me' : ''} leaderboard-column`}>
            <div className='d-flex justify-content-start align-items-center'>
                <span className={'leaderboard-rank'}>#{data.rank}</span>
                <span className='table-mobile-titles ms-2'>RANK</span>
            </div>
        </td>
        <td className={`${data.address == web3Address ? 'me' : ''} leaderboard-column`}>
            <div className='d-flex align-items-center'>
                <img loading={'lazy'} src={`https://www.gravatar.com/avatar/${CryptoJS.MD5(`${data.address}`)}?d=monsterid`} className="avatar-lg" />
                <div className='d-flex align-items-start flex-column ms-3'>
                    <div className='order-username'>
                        {data.address == web3Address ? 'You' : data.username}
                        <img src={getImageUrl(data?.badge?.media)} className='tick ms-2' data-tooltip-id={'global-tooltip'} data-tooltip-content={data?.badge?.title} />
                    </div>
                    <div className='order-address'>{format(data.address)}</div>
                </div>
            </div>
        </td>
        <td className={`${data.address == web3Address ? 'me' : ''} leaderboard-column`}>
            <div className='d-flex justify-content-start align-items-center'>
                <img src={getImageUrl('points.png')} className='points-coin-small mx-2 ms-0' />
                <span className='text-white'>{formatNumber(data.points)}</span>
                <span className='table-mobile-titles ms-2'>XP</span>
            </div>
        </td>
        <td className={`${data.address == web3Address ? 'me' : ''} leaderboard-column`}>
            <span className={`order-pnl ${data.pnl > 0 ? 'green' : 'red'}`}>
                <img src={getImageUrl('coin.png')} className='coin-small me-1' />
                <div className='px-1'>{data.pnl > 0 ? '+' : ''}{formatNumber(data.pnl)}</div>
                <span className='table-mobile-titles ms-2'>PNL</span>
            </span>
        </td>

    </tr>);

});


const LeaderBoardSpotlight = React.memo(({ isFirst = false, position, data }) => {

    const { web3Address = null } = useProvider();

    return (

        <span style={{ position: "relative" }}>
            <div className={`${isFirst == false ? 'leaderboard-spotlight-container' : ''}`}>
                <div className={`leaderboard-spotlight item-${position} ${isFirst == true ? 'leader' : ''}`}>
                    <div className='leaderboard-spotlight-rank'>
                        {position == 1 ? '1st' : ''}
                        {position == 3 ? '3rd' : ''}
                        {position == 2 ? '2nd' : ''}
                    </div>
                    <div className='w-100'>
                        <div className='leaderboard-spotlight-user py-md-3 py-lg-1 px-4'>
                            <img loading={'lazy'} src={`https://www.gravatar.com/avatar/${CryptoJS.MD5(data.address)}?d=monsterid`} className="avatar" />
                            <div className='leaderboard-spotlight-username px-2'>{data.address == web3Address ? 'You' : data.username}</div>
                            <img src={getImageUrl(data?.badge?.media)} className='tick' data-tooltip-id={'global-tooltip'} data-tooltip-content={data?.badge?.title} />
                        </div>
                        <div className='leaderboard-spotlight-points mt-2'>
                            <img loading='lazy' src={getImageUrl('points.png')} className="points-coin" />
                            <div className='leaderboard-spotlight-username px-1'>{formatNumber(data.points)}</div>
                        </div>
                        <div className='row justify-content-center'>
                            <div className='col-auto'>
                                <span className='leaderboard-pts'>XP</span>
                            </div>
                        </div>
                        <div className='mt-3'>
                            <span className={`leaderboard-pnl ${data.pnl > 0 ? 'green' : 'red'}`}>
                                <img src={getImageUrl('coin-alt.png')} className='coin me-1' />
                                <div className='px-1'>{data.pnl > 0 ? '+' : ''}{formatNumber(data.pnl)}</div>
                            </span>
                        </div>
                        <div className='row justify-content-center mb-3'>
                            <div className='col-auto'>
                                <span className='leaderboard-pts'>PnL</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </span>

    );

});

const Leaderboard = React.memo(({ market, data, rewardsDistribution, exchangeRate }) => {

    const [queryToggle, setQueryToggle] = useState(false);

    const { authToken, web3Address, profile } = useProvider();

    const url = baseURL();

    const [refLink, setRefLink] = useState(null);

    const [leaderboard, setLeaderboard] = useState([]);

    const [userRank, setUserRank] = useState([]);

    const [topThree, setTopThree] = useState([]);

    const texts = ['D', 'H', 'M', 'S'];

    const [countdown, setCountdown] = useState(['00', '00', '00', '00']);

    const [referralsDisplay, setReferralsDisplay] = useState({ value: 0, max: 0, percentage: 0 });

    useState(() => {
        if (profile) {
            setRefLink(`${url}/ref/${profile.username}`);
            const display = displayReferrals(profile?.referrals);
            setReferralsDisplay(display);
        }
    }, [profile]);

    const loadLeaderboard = async () => {

        try {

            const marketSymbol = market?.toUpperCase();

            const response = await fetch(`${SERVER_ROOT}/auth/${authToken}/${marketSymbol}/leaderboard`, { method: 'GET' });

            if (response.ok) {
                const data = await response.json();
                if (data.status == "success") {
                    setLeaderboard(data.leaderboard.slice(3));
                    if (data.userRank != null) {
                        setUserRank([data.userRank]);
                    }
                    setTopThree(data.leaderboard.slice(0, 3));
                }
            }
            else {
                setLeaderboard([]);
                setUserRank({});
                setTopThree([]);
            }
        }
        catch (error) {
            console.log(error);
        }

        await delayFor(5000);

        setQueryToggle(!queryToggle);

    }

    useEffect(() => {
        loadLeaderboard();
    }, [queryToggle]);

    useEffect(() => {
        const difference = (data.endTime - data.timestamp);
        if (difference == 0) {
            loadLeaderboard();
        }
        setCountdown(dhms(difference));
    }, [data, market]);

    return (
        <>
            {url ?
                <>
                    {profile?.username ?
                        <div className='row my-4 align-items-center justify-content-center white-text'>
                            <div className='col-lg-auto d-flex align-items-center justify-content-center my-2 mx-2 mt-4'>
                                <span className='mx-2 col-lg-auto total-referrals'>Referrals</span>
                                <div className='loading-container-alt mx-2'>
                                    <div className='loading-bar' style={{ width: `${referralsDisplay.percentage}%` }}></div>
                                </div>
                                <span className='referrals-count mx-2'>{referralsDisplay?.value.toLocaleString()} / {referralsDisplay?.max.toLocaleString()}</span>
                            </div>
                            <div className='col-lg-auto d-flex justify-content-center align-items-center my-2 mx-2 mt-4'>
                                <button className='copy-link' onClick={() => {
                                    navigator.clipboard.writeText(refLink).then(() => {
                                        toast.success("Your referral link has been copied to clipboard!");
                                    });
                                }} >
                                    <img src={getImageUrl('copy.png')} className='copy ms-1' />
                                    <span className='ms-2'>Copy link</span>
                                </button>
                            </div>
                        </div>
                        : null
                    }
                </>
                : null
            }

            <div className='row justify-content-center align-items-center mt-5 px-3'>
                {topThree?.map((value, index) => {
                    return (<div key={index} className={`col-sm-auto leaderboard-item order-md-${value.rank} order-lg-${value.rank == 3 ? '3' : (value.rank == 2 ? '1' : '2')} order-${value.rank}`}>
                        <center>
                            <LeaderBoardSpotlight position={value.rank} isFirst={value.rank == 1 ? true : false} data={value} />
                        </center>
                    </div>)
                })}
            </div>

            <div className='row justify-content-center align-items-center my-4 px-3'>
                <div className='col-xl-auto d-flex align-items-center justify-content-center my-2'>
                    <span className='market-index-title text-white'>Countdown to EOW</span>
                </div>
                {countdown?.map((value, index) => {
                    return (<div key={index} className='col-auto my-2'>
                        <div className='leaderboard-counter'>
                            <span>{value} {texts[index]}</span>
                        </div>
                    </div>)
                })}
            </div>

            <div className='row mt-5 px-0 mx-0'>

                <marquee className={'rewards-marquee'}>

                    {rewardsDistribution?.map((value, index) => {
                        return (<div key={index} className='rewards-item mx-4'
                            data-tooltip-id='global-tooltip' data-tooltip-content={`Rewards to be distributed by EOW to the ${rankText(index + 1)} ranking player`}>

                            <span className='me-3 rewards-index'>
                                {rankText(index + 1)}
                            </span>
                            <img src={getImageUrl('coin.png')} className='coin-small' />
                            <span className='mx-2'>{value.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            <span className='usd-value-alt'>~ ${Math.ceil(exchangeRate * value).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>

                        </div>)
                    })}

                </marquee>

            </div>

            <div className='my-5 mt-4 px-2'>
                <table className='my-4 mt-0 w-100' cellSpacing={0} cellPadding={0}>
                    <thead className='table-head'>
                        <tr>
                            <td scope="col">Rank</td>
                            <td scope="col">Account</td>
                            <td scope="col">Points</td>
                            <td scope="col">PnL</td>
                        </tr>
                    </thead>
                    <tbody className='table-body'>
                        {userRank?.concat(leaderboard)?.map((value, index) => {
                            if (index > 0 && value.address == web3Address) {
                                return null;
                            }
                            else {
                                return <LeaderboardItem key={index} data={value} />
                            }
                        })}
                    </tbody>
                </table>
            </div>

            <div className='d-flex align-items-center justify-content-center w-100 mt-5'>
                <Socials />
            </div>

        </>

    );
});

export default Leaderboard;