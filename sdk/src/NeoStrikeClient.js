import axios from 'axios';

class NeoStrikeClient {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || 'http://localhost:5000';
        this.token = config.token;
        this.brandId = config.brandId || '1';
        this.username = config.username;
        const headers = {
            'Content-Type': 'application/json',
            'x-brand-id': this.brandId
        };

        if (this.token) {
            const tokenValue = this.token.startsWith('Bearer ') ? this.token : `Bearer ${this.token}`;
            headers['Authorization'] = tokenValue;
        }
        if (this.username) {
            headers['x-username'] = this.username;
        }

        this.client = axios.create({
            baseURL: this.apiUrl,
            headers: headers
        });
    }

    isAuthenticated() {
        return !!this.token;
    }

    async getGameCatalog(filters = {}) {
        const response = await this.client.get('/api/v1/games/catalog', { params: filters });
        return response.data;
    }

    async getRecentlyPlayed() {
        const response = await this.client.get('/api/user/recently-played');
        return response.data;
    }

    async getFavourites() {
        const response = await this.client.get('/api/user/favourites');
        return response.data;
    }

    async toggleFavourite(gameId) {
        const response = await this.client.post('/api/user/favourites/toggle', { game_id: gameId });
        return response.data;
    }

    async trackGameLaunch(gameId) {
        await this.client.post('/api/user/track-activity', { activity: 'game_launch', game_id: gameId });
    }

    async getPaymentMethods(type = 'deposit') {
        const response = await this.client.get(`/api/payments/methods?type=${type}`);
        return response.data;
    }

    async processPayment(data) {
        const response = await this.client.post('/api/payments/process', data);
        return response.data;
    }

    async getActivePromotions() {
        const response = await this.client.get('/api/promotions/active');
        return response.data;
    }

    async getLobbyCuration() {
        const response = await this.client.get('/api/v1/lobby/curation');
        return response.data;
    }

    async getTransactions() {
        const response = await this.client.get('/api/user/transactions');
        return response.data;
    }

    async getKycStatus() {
        const response = await this.client.get('/api/user/kyc-status');
        return response.data;
    }

    async deleteAccount() {
        const response = await this.client.post('/api/user/delete-account');
        return response.data;
    }

    async updateConsents(consents) {
        const response = await this.client.post('/api/user/consents', { consents });
        return response.data;
    }

    async getBalance() {
        const response = await this.client.get('/api/balance');
        return response.data;
    }
}

export { NeoStrikeClient };
