import debounce from 'lodash/debounce';
import { getImageUrl } from '../helpers/Utils';

const debouncedOnSearch = debounce((value, onAmount) => {
    onAmount(parseFloat(value) || '');
}, 500);

const AmountInput = ({ onAmount, reference, isPercent = false }) => {

    const handleChange = (e) => {
        const value = `${e.target.value}`;
        debouncedOnSearch(value, onAmount);
    };

    const clear = () => {
        const event = new Event("input", { bubbles: true });
        reference.current.value = '';
        reference.current.dispatchEvent(event);
        reference.current.focus();
    }

    return (

        <div className='d-flex align-items-center justify-content-between' style={{ flex: 1 }}>
            <input
                className="amount"
                style={{ flex: 1 }}
                type="number"
                ref={reference}
                onInput={handleChange}
                placeholder={'0.00'}
            />

            {isPercent == true?
                <span className='percentage-symbol me-2'>( % )</span>
                :null
            }

            <img src={getImageUrl('close.png')} className='input-clear mx-2' onClick={() => clear()} />

        </div>
        
    );
}

export default AmountInput;