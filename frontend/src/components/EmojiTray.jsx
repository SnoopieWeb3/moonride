import { useEffect } from 'react';
import { getImageUrl } from '../helpers/Utils';
import { Swiper, SwiperSlide } from 'swiper/react';

const EmojiTray = ({ emojis = [], onSend, badge }) => {

    const sendEmoji = (value) => {
        if (badge.index == 1 && value.noobUnlocked == false) {
            return false;
        }
        onSend(value);
    }

    return (
        <>
            {emojis.length > 0 ?
                <Swiper
                    className='mt-1 py-2 emoji-tray'
                    spaceBetween={15}
                    slidesPerView="auto"
                    freeMode={false}
                >
                    {emojis.map((value, index) => {
                        return <SwiperSlide
                            style={{ backgroundImage: `url(${getImageUrl(`emojis/${value.id}.gif`)}` }}
                            key={index}
                            className={`emoji-button mx-2`}
                            onClick={() => sendEmoji(value)}
                            data-tooltip-id={badge.index == 1 && value.noobUnlocked == false ? 'global-tooltip' : null}
                            data-tooltip-content={`You need to advance to a level higher than ${badge.title} to use this sticker`}
                        >
                            {badge.index == 1 && value.noobUnlocked == false ?
                                <img src={getImageUrl('locked.png')} className='locked-emoji' />
                                : null
                            }
                        </SwiperSlide>
                    })}
                </Swiper> : null
            }
        </>
    );
}

export default EmojiTray;