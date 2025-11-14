const Info = ({ text }) => {

    return (
        <i className='fas fa-info-circle tooltip-info mx-2' data-tooltip-id={'global-tooltip'} data-tooltip-content={text}></i>
    );
}

export default Info;