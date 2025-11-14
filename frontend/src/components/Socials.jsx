import { getImageUrl } from '../helpers/Utils';

const Socials = () => {
    return (
        <div className='socials py-3'>
            <img src={getImageUrl('telegram.png')} className='social mx-2' onClick={()=>open('https://t.me/moonridedotfun')} />
            <img src={getImageUrl('discord.png')} className='social mx-2' onClick={()=>open('https://discord.com/invite/EjR6CzZ9Su')}/>
            <img src={getImageUrl('x.png')} className='social mx-2 me-0' onClick={()=>open('https://x.com/moonridedotfun')} />
        </div>
    );
}

export default Socials;