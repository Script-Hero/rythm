/**
 * API service layer for strategy management and backtesting
 */

import type { Strategy } from '../types/strategy';

export interface SaveStrategyRequest {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  nodes: any[];
  edges: any[];
  id?: string; // For updates
}

export interface BacktestRequest {
  strategy?: string;
  strategy_id?: string;
  ticker: string;
  fromDate: string;
  toDate: string;
  interval: string;
}

export interface BacktestResponse {
  bar_data: string; // JSON string
  analytics: any;
}

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Beta2 Microservices Configuration - All requests go through API Gateway
const API_BASE_URL = 'http://localhost:8000';

// Keep direct service URLs for reference but all requests should use API Gateway
const API_GATEWAY_URL = 'http://localhost:8000';
const STRATEGY_SERVICE_URL = 'http://localhost:8002';
const FORWARD_TEST_SERVICE_URL = 'http://localhost:8003';
const MARKET_DATA_SERVICE_URL = 'http://localhost:8001';
const BACKTESTING_SERVICE_URL = 'http://localhost:8004';

class ApiService {
  private getAuthToken(): string | null {
    return localStorage.getItem('algotrade_auth_token');
  }

  private setAuthToken(token: string): void {
    localStorage.setItem('algotrade_auth_token', token);
  }

  private clearAuthToken(): void {
    localStorage.removeItem('algotrade_auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const token = this.getAuthToken();
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.clearAuthToken();
          throw new Error('Not authenticated');
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error);
      throw error;
    }
  }

  // Authentication methods
  async login(username: string, password: string): Promise<{ access_token: string; token_type: string; expires_in: number }> {
    const response = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    
    if (response.access_token) {
      this.setAuthToken(response.access_token);
    }
    
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.warn('Logout request failed, clearing token anyway');
    }
    this.clearAuthToken();
  }

  async getCurrentUser(): Promise<any> {
    return this.request('/api/auth/me');
  }

  isAuthenticated(): boolean {
    return this.getAuthToken() !== null;
  }

  async initializeDevAuth(): Promise<void> {
    if (this.isAuthenticated()) {
      try {
        await this.getCurrentUser();
        console.log('✅ Already authenticated with valid token');
        return;
      } catch (error) {
        console.log('❌ Existing token invalid, need to re-authenticate');
        this.clearAuthToken();
      }
    }

    console.log('🔧 DEV MODE: Auto-authenticating with demo account...');
    try {
      await this.login('demo', 'demo123');
      console.log('✅ Authenticated as demo user');
    } catch (error) {
      console.log('❌ Demo auth failed, user might need to be created');
      throw error;
    }
  }

  // Strategy CRUD operations
  async saveStrategy(data: SaveStrategyRequest): Promise<{ success: boolean; id: string; message: string }> {
    return this.request('/api/strategies/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStrategy(id: string): Promise<Strategy> {
    return this.request(`/api/strategies/${id}`);
  }

  async listStrategies(params?: {
    category?: string;
    include_templates?: boolean;
  }): Promise<{ strategies: Strategy[] }> {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.append('category', params.category);
    if (params?.include_templates !== undefined) {
      searchParams.append('include_templates', params.include_templates.toString());
    }
    
    const query = searchParams.toString();
    const endpoint = `/api/strategies/${query ? `?${query}` : ''}`;
    return this.request(endpoint);
  }

  async updateStrategy(id: string, data: SaveStrategyRequest): Promise<{ success: boolean; id: string; message: string }> {
    return this.request(`/api/strategies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStrategy(id: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/strategies/${id}`, {
      method: 'DELETE'
    });
  }

  async duplicateStrategy(id: string, newName: string): Promise<{ success: boolean; id: string; message: string }> {
    return this.request(`/api/strategies/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name: newName }),
    });
  }

  async searchStrategies(query: string): Promise<{ strategies: Strategy[] }> {
    const searchParams = new URLSearchParams({ q: query });
    return this.request(`/api/strategies/search?${searchParams.toString()}`);
  }

  async getStrategyStats(): Promise<{
    total_strategies: number;
    custom_strategies: number;
    templates: number;
    categories: string[];
  }> {
    return this.request('/api/strategies/stats');
  }

  // Backtesting
  async runBacktest(data: BacktestRequest): Promise<BacktestResponse> {
    return this.request('/api/backtest/run', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Forward Testing (Multi-Session Architecture)
  async createForwardTestSession(data: { name: string; strategy: any; settings: any }): Promise<{ success: boolean; session_id: string; message: string }> {
    return this.request('/api/forward-test/', {
      method: 'POST',
      headers: {
        'X-User-ID': this.getUserId()
      },
      body: JSON.stringify(data),
    });
  }

  async startForwardTestSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/forward-test/${sessionId}/start`, {
      method: 'POST'
    });
  }

  // NOTE: Backend doesn't have pause - using stop instead
  async pauseForwardTest(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/forward-test/${sessionId}/stop`, {
      method: 'POST'
    });
  }

  // NOTE: Backend doesn't have resume - using start instead  
  async resumeForwardTest(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/forward-test/${sessionId}/start`, {
      method: 'POST'
    });
  }

  async stopForwardTest(sessionId: string): Promise<{ success: boolean; message: string; final_results: any }> {
    return this.request(`/api/forward-test/${sessionId}/stop`, {
      method: 'POST'
    });
  }

  async getForwardTestStatus(sessionId: string): Promise<{ success: boolean; test_session: any }> {
    return this.request(`/api/forward-test/${sessionId}`);
  }

  async updateSessionStatus(sessionId: string, status: string, portfolio?: any, metrics?: any): Promise<{ success: boolean; message: string; session_id: string; status: string }> {
    return this.request(`/api/forward-test/${sessionId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, portfolio, metrics })
    });
  }

  async deleteForwardTestSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/forward-test/${sessionId}`, {
      method: 'DELETE',
      headers: { 'X-User-ID': this.getUserId() }
    });
  }

  async getForwardTestSessionDetail(sessionId: string): Promise<{ 
    success: boolean; 
    session_detail: {
      session: {
        id: string;
        name: string;
        strategy: any;
        status: string;
        start_time: string;
        symbol: string;
        settings: any;
        portfolioValue: number;
      };
      portfolio: any;
      metrics: any;
      trades: any[];
    }
  }> {
    return this.request(`/api/forward-test/${sessionId}`, {
      headers: { 'X-User-ID': this.getUserId() }
    });
  }

  async getForwardTestSymbols(): Promise<{ success: boolean; symbols: string[] }> {
    return this.request('/api/market/symbols');
  }

  // Session Data Persistence
  async getUserSessions(): Promise<{ 
    success: boolean; 
    sessions: any[];
  }> {
    return this.request('/api/forward-test/', {
      headers: { 'X-User-ID': this.getUserId() }
    });
  }

  async restoreSessionData(sessionId: string): Promise<{ 
    success: boolean; 
    session: any;
    chart_data: any;
    trades: any[];
    restored_at: string;
  }> {
    const result = await this.request('/api/forward-test/restore', {
      method: 'POST',
      headers: {
        'X-User-ID': this.getUserId()
      },
      body: JSON.stringify({ session_id: sessionId }),
    });
    
    // Handle wrapped response from backend
    if (result.success && result.data) {
      return {
        success: result.success,
        session: result.data.session,
        chart_data: result.data.chart_data,
        trades: result.data.trades,
        restored_at: result.data.restored_at
      };
    }
    
    return result;
  }

  // Simple user identification for multi-user support
  private getUserId(): string {
    // Generate or retrieve user ID from localStorage
    let userId = localStorage.getItem('algotrade_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('algotrade_user_id', userId);
    }
    return userId;
  }
}

export const apiService = new ApiService();