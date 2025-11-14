import { useEffect, useRef } from 'react';

import { getImageUrl } from '../helpers/Utils';

const OutcomeModal = (props) => {

    const { children } = props;

    const modalBackgroundRef = useRef(null);
    const modalForegroundRef = useRef(null);

    const hide = () => {
        try {
            modalBackgroundRef.current.style.animation = `hide 0.3s forwards ease-in-out`;
            modalForegroundRef.current.style.animation = `swipe-out 0.6s forwards ease-in-out`;
            const closeTimeout = setTimeout(() => {
                props.close();
                clearTimeout(closeTimeout);
            }, 300);
        }
        catch (error) { }
    }

    useEffect(() => {
        setTimeout(() => {
            hide();
        }, 120000);
    }, []);

    return (

        <div ref={modalBackgroundRef} className={`flip-modal`}>

            <div ref={modalForegroundRef} className='flip-modal-content-alt' style={props.width ? { width: props.width } : undefined}>

                <div className={`d-flex w-100 align-items-center justify-content-end my-2 px-3`}>
                    <div onClick={() => hide()} style={{ cursor: "pointer" }}>
                        <img src={getImageUrl('close.png')} className='flip-close-btn mx-2' />
                    </div>
                </div>

                <div className='flip-modal-body-alt'>
                    {children}
                    <div className='py-4 pt-2 row pb-0'>
                        <div className='col-md-12'>
                            <center>
                                <button className='flat-button continue-betting' onClick={() => hide()}>Continue betting</button>
                            </center>
                        </div>
                    </div>
                </div>

            </div>

        </div>

    );
};

export default OutcomeModal;