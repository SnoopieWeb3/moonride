import React, { useEffect, useRef, useCallback } from 'react';

import { getImageUrl } from '../helpers/Utils';

const Modal = React.memo((props) => {

    const modalBackgroundRef = useRef(null);
    const modalForegroundRef = useRef(null);

    const escFunction = useCallback((event) => {
        if (event.key === "Escape") {
            hide();
        }
    }, []);

    useEffect(() => {

        const modalEl = modalForegroundRef.current;

        if (!modalEl || !props.onScrollToBottom) return;

        const handleScroll = () => {
            const scrollTop = modalEl.scrollTop;
            const scrollHeight = modalEl.scrollHeight;
            const clientHeight = modalEl.clientHeight;

            if (scrollTop + clientHeight >= scrollHeight - 1) {
                props.onScrollToBottom();
            }

        };

        modalEl.addEventListener('scroll', handleScroll);

        return () => {
            modalEl.removeEventListener('scroll', handleScroll);
        };

    }, [props.onScrollToBottom, modalForegroundRef]);

    useEffect(() => {

        document.addEventListener("keydown", escFunction, false);

        return () => {
            document.removeEventListener("keydown", escFunction, false);
        };

    }, [escFunction]);

    const { children } = props;

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

    const obstructed = (e) => {
        if (e.target != e.currentTarget) {
            e.stopPropagation();
        }
        else {
            if (props.cannotHide) {
                return false;
            }
            modalBackgroundRef.current.style.animation = `hide 0.3s forwards ease-in-out`;
            modalForegroundRef.current.style.animation = `swipe-out 0.6s forwards ease-in-out`;
            let closeTimeout = setTimeout(() => {
                props.close();
                clearTimeout(closeTimeout);
            }, 300);
        }
    }

    return (

        <div ref={modalBackgroundRef} className={`flip-modal`} onClick={(e) => { obstructed(e) }}>

            <div ref={modalForegroundRef} className='flip-modal-content' style={props.width ? { width: props.width } : undefined}>

                <div className={`d-flex w-100 align-items-center justify-content-between mt-2 modal-head-section px-3`}>
                    <div className='flip-modal-title px-3'>
                        <div className='modal-heading'>{props.title}</div>
                        <div className='modal-sub-heading'>{props.sub}</div>
                    </div>
                    <div onClick={() => hide()} style={{ cursor: "pointer" }}>
                        <img src={getImageUrl('close.png')} className='flip-close-btn mx-2' />
                    </div>
                </div>

                <div className='flip-modal-body'>
                    {children}
                </div>

            </div>

        </div>

    );
});

export default Modal;