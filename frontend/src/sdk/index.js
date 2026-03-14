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
            user_id: this.username || this.token.replace('token-', '').split('-')[0]
        });
        return response.data; // Returns { balance, bonus_balance, currency }
    }

    async credit(amount, gameId, transactionId) {
        const response = await this.client.post('/api/credit', {
            amount,
            game_id: gameId,
            transaction_id: transactionId || `tx-${Date.now()}`,
            user_id: this.username || this.token.replace('token-', '').split('-')[0]
        });
        return response.data;
    }

    async deposit(amount) {
        const response = await this.client.post('/api/deposit', {
            amount
        });
        return response.data;
    }

    async getAlerts() {
        const response = await this.client.get('/api/user/alerts');
        return response.data;
    }

    async getGameCatalog(filters = {}) {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        if (filters.category && filters.category !== 'all') params.set('category', filters.category);
        if (filters.provider) params.set('provider', filters.provider);
        if (filters.page) params.set('page', filters.page);
        if (filters.limit) params.set('limit', filters.limit);

        const response = await this.client.get(`/api/v1/games/catalog?${params.toString()}`);
        return response.data;
    }

    async getRecentlyPlayed() {
        const response = await this.client.get('/api/user/recently-played');
        return response.data; // Expected: { games: [...] }
    }

    async getFavourites() {
        const response = await this.client.get('/api/user/favourites');
        return response.data; // Expected: { games: [...] }
    }

    async toggleFavourite(gameId) {
        const response = await this.client.post('/api/user/favourites/toggle', { game_id: gameId });
        return response.data; // Expected: { is_favourite: boolean }
    }

    async trackGameLaunch(gameId) {
        // Internal tracking for Recently Played
        await this.client.post('/api/user/track-activity', { activity: 'game_launch', game_id: gameId });
    }

    async getPaymentMethods(type = 'deposit') {
        const response = await this.client.get(`/api/payments/methods?type=${type}`);
        return response.data; // Expected: { methods: [...] }
    }

    async processPayment(data) {
        const response = await this.client.post('/api/payments/process', data);
        return response.data; // Expected: { success: boolean, transaction_id: string, status: string }
    }

    async getActivePromotions() {
        const response = await this.client.get('/api/promotions/active');
        return response.data; // Expected: { promotions: [...] }
    }

    async getLobbyCuration() {
        const response = await this.client.get('/api/v1/lobby/curation');
        return response.data; // Expected: { carousels: [...] }
    }

    async getTransactions() {
        const response = await this.client.get('/api/user/transactions');
        return response.data; // Expected: { transactions: [...] }
    }

    async getKycStatus() {
        const response = await this.client.get('/api/user/kyc-status');
        return response.data; // Expected: { status: 'pending'|'verified'|'failed', details: ... }
    }

    async deleteAccount() {
        const response = await this.client.post('/api/user/delete-account');
        return response.data; // Expected: { success: true }
    }

    async updateConsents(consents) {
        const response = await this.client.post('/api/user/consents', { consents });
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
