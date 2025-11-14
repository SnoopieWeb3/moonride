import {
    createContext,
    useContext,
    useState,
    useRef,
    useEffect
} from "react";

import { SERVER_ROOT } from "../helpers/Utils";

const Web3Context = createContext({
    web3Address: null,
    authToken: '0',
    profile: null,
    socketRef: null,
    socketChanged: true,
    refCode: undefined,
    setWeb3Address: () => { },
    setSocketRef: () => { },
    setProfile: () => { },
    setRefCode: () => { },
    setSocketChanged: () => { }
});

export const Web3Provider = ({ children }) => {

    const [web3Address, setWeb3Address] = useState(null);
    const [authToken, setAuthToken] = useState('0');
    const [profile, setProfile] = useState(null);

    const [refCode, setRefCode] = useState(null);

    const socketRef = useRef(null);
    const timeoutRef = useRef(setTimeout(() => { }, 1000));
    const [socketChanged, setSocketChanged] = useState(true);

    const setSocketRef = (socket) => {
        socketRef.current = socket;
    };

    useEffect(() => {

        const handleBlur = () => {
            timeoutRef.current = setTimeout(() => {
                if (socketRef.current && socketRef.current.connected) {
                    socketRef.current.disconnect();
                    setSocketChanged(false);
                }
            }, 30000);
        }

        const handleFocus = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            if (socketRef.current && !socketRef.current.connected) {
                socketRef.current.connect();
                setSocketChanged(true);
            }
        }

        window.addEventListener('blur', handleBlur);
        window.addEventListener('focus', handleFocus);

        return () => {
            window.removeEventListener('blur', handleBlur);
            window.removeEventListener('focus', handleFocus);
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const loadProfile = async () => {
        try {
            const token = localStorage.getItem(web3Address);
            const response = await fetch(`${SERVER_ROOT}/auth/${token}/profile`, { method: 'GET' });
            if (!response.ok) {
                setProfile(null);
                return false;
            }
            setAuthToken(token);
            const data = await response.json();
            setProfile(data.account);
            try {
                socketRef.current.disconnect();
                socketRef.current.connect();
            }
            catch (error) { }
        } catch (error) {
            setProfile(null);
        }
    };

    return (
        <Web3Context.Provider value={{
            setWeb3Address, web3Address, setProfile, profile, loadProfile, authToken, refCode, setRefCode,
            socketRef, setSocketRef, socketChanged
        }}>
            {children}
        </Web3Context.Provider>
    );
};

export const useProvider = () => useContext(Web3Context);