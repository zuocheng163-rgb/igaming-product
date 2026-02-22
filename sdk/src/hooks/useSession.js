import { useState, useCallback } from 'react';
import axios from 'axios';
import { getEnv, logSDKEvent } from '../utils';

// In-memory token storage (XSS Mitigation)
let authToken = null;

export const useSession = (config = {}) => {
    const [player, setPlayer] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const login = useCallback(async (username, password) => {
        setLoading(true);
        try {
            const apiUrl = getEnv('VITE_NEOSTRIKE_API_URL');
            const apiKey = getEnv('VITE_NEOSTRIKE_API_KEY');

            const response = await axios.post(`${apiUrl}/api/authenticate`, {
                username,
                password
            }, {
                headers: {
                    'x-api-key': apiKey,
                    'x-brand-id': config.brandId || '1'
                }
            });

            authToken = response.data.token;
            setPlayer(response.data.user);
            setError(null);
            logSDKEvent('AUTH', `User ${username} logged in successfully`, { userId: response.data.user.id });
            return response.data;
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            logSDKEvent('ERROR', `Login failed: ${msg}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [config.brandId]);

    const register = useCallback(async (userData) => {
        setLoading(true);
        try {
            const response = await axios.post(`${process.env.VITE_NEOSTRIKE_API_URL}/api/register`, userData, {
                headers: {
                    'x-api-key': process.env.VITE_NEOSTRIKE_API_KEY,
                    'x-brand-id': config.brandId || '1'
                }
            });

            authToken = response.data.token;
            setPlayer(response.data.user);
            setError(null);
            logSDKEvent('AUTH', `User ${userData.username} registered successfully`);
            return response.data;
        } catch (err) {
            const msg = err.response?.data?.error || err.message;
            setError(msg);
            logSDKEvent('ERROR', `Registration failed: ${msg}`);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [config.brandId]);

    const logout = () => {
        const username = player?.username;
        authToken = null;
        setPlayer(null);
        logSDKEvent('AUTH', `User ${username} logged out`);
    };

    return {
        player,
        login,
        logout,
        register,
        isAuthenticated: !!player && !!authToken,
        loading,
        error,
        getToken: () => authToken
    };
};
