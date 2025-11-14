import { getImageUrl } from '../helpers/Utils';

import { useNetworkState } from "@uidotdev/usehooks";

const Network = () => {
    const network = useNetworkState();
    return (
        <div className='ms-2 me-0 me-0 pe-lg-5'>
            {network.online == false || network.downlink < 0.5 ?
                <img src={getImageUrl('network-bad.png')} className='network-strength' data-tooltip-id='global-tooltip' data-tooltip-content={"Poor/Disconnected internet"}/>
                :
                <img src={getImageUrl('network-good.png')} className='network-strength' data-tooltip-id='global-tooltip' data-tooltip-content={'Good internet!'}/>
            }
        </div>
    );
}

export default Network;