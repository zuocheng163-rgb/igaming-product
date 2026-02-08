import axios from 'axios';

class NeoStrikeClient {
    constructor(config) {
        this.apiUrl = config.apiUrl || 'http://localhost:5000';
        this.token = config.token;
        this.username = config.username;
        this.client = axios.create({
            baseURL: this.apiUrl,
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                'x-username': this.username
            }
        });
    }

    async connect() {
        // No persistent connection needed for REST
        // We verify the token by fetching the balance/user details
        try {
            const response = await this.client.get('/api/balance');
            return response.data;
        } catch (error) {
            console.error('NeoStrike Client Connection Failed:', error.message);
            throw error;
        }
    }

    // Standard Wallet Operations
    async debit(amount, gameId, transactionId) {
        const response = await this.client.post('/api/debit', {
            amount,
            game_id: gameId,
            transaction_id: transactionId || `tx-${Date.now()}`,
            user_id: this.token.replace('token-', '') // Simplified for demo
        });
        return response.data; // Returns { balance, bonus_balance, currency }
    }

    async credit(amount, gameId, transactionId) {
        const response = await this.client.post('/api/credit', {
            amount,
            game_id: gameId,
            transaction_id: transactionId || `tx-${Date.now()}`,
            user_id: this.token.replace('token-', '')
        });
        return response.data;
    }

    async deposit(amount) {
        const response = await this.client.post('/api/deposit', {
            amount
        });
        return response.data;
    }

    // Legacy support for event listeners (noop for now as we don't have WS)
    on(event, handler) {
        console.warn(`[NeoStrikeClient] .on('${event}') called, but WebSockets are removed. State is updated via API responses.`);
    }

    off(event, handler) { }

    disconnect() { }
}

export { NeoStrikeClient };
