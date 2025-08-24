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

export interface BacktestJobResponse {
  success: boolean;
  job_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  message: string;
  progress?: number;
  results?: BacktestResponse;
  error_message?: string;
  estimated_duration?: number;
  created_at?: number;
  completed_at?: number;
}

export interface ForwardTestSession {
  id: string;
  name: string;
  strategy_id: string;
  symbol: string;
  status: 'CREATED' | 'RUNNING' | 'PAUSED' | 'STOPPED' | 'ERROR';
  initial_capital: number;
  current_capital?: number;
  created_at: number;
  started_at?: number;
  stopped_at?: number;
  risk_management?: any;
  description?: string;
}

export interface PortfolioSummary {
  session_id: string;
  cash_balance: number;
  total_value: number;
  total_pnl: number;
  total_pnl_percent: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    avg_price: number;
    current_price: number;
    market_value: number;
    pnl: number;
    pnl_percent: number;
  }>;
  position_count: number;
  updated_at: number;
}

export interface SessionMetrics {
  session_id: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate: number;
  total_pnl: number;
  total_pnl_percent: number;
  max_drawdown: number;
  max_drawdown_percent: number;
  average_trade_pnl: number;
  largest_win: number;
  largest_loss: number;
  consecutive_wins: number;
  consecutive_losses: number;
  updated_at: number;
}

export interface RealtimeUpdate {
  type: 'portfolio_update' | 'trade_execution' | 'strategy_signal' | 'forward_test_event' | 'realtime_update';
  session_id?: string;
  data: any;
  timestamp: number;
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
const NOTIFICATION_SERVICE_URL = 'http://localhost:8005';

// WebSocket endpoint for real-time notifications
export const WEBSOCKET_URL = 'ws://localhost:8005/ws';

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
    
    console.log('🌐 Frontend: API Request', {
      endpoint: endpoint,
      method: options.method || 'GET',
      hasBody: !!options.body,
      bodyPreview: options.body ? JSON.stringify(JSON.parse(options.body as string), null, 2).slice(0, 500) : null
    });
    
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
      const startTime = Date.now();
      const response = await fetch(url, config);
      const duration = Date.now() - startTime;
      
      console.log('📡 Frontend: API Response', {
        endpoint: endpoint,
        status: response.status,
        statusText: response.statusText,
        duration: `${duration}ms`,
        ok: response.ok
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.warn('🔒 Frontend: Authentication failed, redirecting to login');
          this.clearAuthToken();
          // Trigger a page reload to redirect to login
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          throw new Error('Authentication required');
        }
        
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          console.error('❌ Frontend: API Error Details', {
            endpoint: endpoint,
            status: response.status,
            errorData: errorData
          });
          
          // Extract error message from nested structure
          if (errorData.error && typeof errorData.error === 'object') {
            // Handle nested error objects (e.g., { error: { message: "...", compilation_errors: [...] } })
            errorMessage = errorData.error.message || 
                          (errorData.error.compilation_errors && errorData.error.compilation_errors.length > 0 
                            ? `Compilation failed: ${errorData.error.compilation_errors.join(', ')}` 
                            : JSON.stringify(errorData.error));
          } else {
            // Handle simple string errors
            errorMessage = errorData.error || errorData.detail || errorData.message || errorMessage;
          }
        } catch {
          // Failed to parse error response, use default message
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('✅ Frontend: API Success', {
        endpoint: endpoint,
        responseKeys: Object.keys(responseData),
        hasData: !!responseData.data,
        success: responseData.success
      });
      
      return responseData;
    } catch (error) {
      console.error('💥 Frontend: API Request Exception', {
        endpoint: endpoint,
        error: error.message,
        method: options.method || 'GET'
      });
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

  async initializeAuth(): Promise<void> {
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
    
    // Auto-authenticate in development mode
    try {
      console.log('🔧 Attempting development authentication...');
      
      // First try normal login with dev credentials
      try {
        console.log('🔄 Trying normal login with dev credentials...');
        const loginResponse = await this.login('dev_user', 'dev_password');
        console.log('✅ Development authentication successful with real user');
        return;
      } catch (loginError) {
        console.log('⚠️ Normal dev login failed, trying dev-login endpoint...');
        
        // Fallback to dev-login endpoint
        const response = await fetch(`${API_BASE_URL}/api/auth/dev-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        if (response.ok) {
          const authData = await response.json();
          this.setAuthToken(authData.access_token);
          console.log('✅ Development authentication successful with fallback');
        } else {
          console.log('❌ Development authentication failed', await response.text());
        }
      }
    } catch (error) {
      console.log('❌ Development authentication error:', error);
    }
  }

  // Strategy CRUD operations
  async saveStrategy(data: SaveStrategyRequest): Promise<{ success: boolean; id: string; message: string }> {
    console.log('🆕 Frontend: Saving strategy', {
      name: data.name,
      category: data.category,
      tags: data.tags,
      nodeCount: data.nodes?.length || 0,
      edgeCount: data.edges?.length || 0,
      nodeTypes: data.nodes?.map(node => node.type) || [],
      isUpdate: !!data.id
    });

    const { nodes, edges, ...strategyData } = data;
    const requestBody = {
      ...strategyData,
      json_tree: { nodes, edges }
    };
    
    console.log('📊 Frontend: Strategy structure being sent', {
      strategyData: strategyData,
      nodeStructure: nodes?.map(node => ({
        id: node.id,
        type: node.type,
        dataKeys: Object.keys(node.data || {})
      })) || [],
      edgeStructure: edges?.map(edge => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle
      })) || []
    });
    
    try {
      const response = await this.request<{ success: boolean; data: { id: string }; message: string }>('/api/strategies/', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });
      
      console.log('✅ Frontend: Strategy save response', {
        success: response.success,
        id: response.data?.id,
        message: response.message
      });
      
      return {
        success: response.success,
        id: response.data?.id || '',
        message: response.message
      };
    } catch (error) {
      console.error('❌ Frontend: Strategy save failed', {
        error: error.message,
        strategyName: data.name,
        nodeCount: nodes?.length || 0
      });
      throw error;
    }
  }

  async getStrategy(id: string): Promise<Strategy> {
    const response: any = await this.request(`/api/strategies/${id}`);
    console.log('📦 getStrategy response structure:', response);
    // Backend returns StandardResponse with {success, data, message}
    return response.data || response;
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
    const response = await this.request<{ success: boolean; data: { strategies: Strategy[] }; message: string }>(endpoint);
    return response.data || { strategies: [] };
  }

  async updateStrategy(id: string, data: SaveStrategyRequest): Promise<{ success: boolean; id: string; message: string }> {
    console.log('📝 Frontend: Updating strategy', {
      strategyId: id,
      name: data.name,
      category: data.category,
      tags: data.tags,
      nodeCount: data.nodes?.length || 0,
      edgeCount: data.edges?.length || 0,
      nodeTypes: data.nodes?.map(node => node.type) || []
    });

    const { nodes, edges, ...strategyData } = data;
    const requestBody = {
      ...strategyData,
      json_tree: { nodes, edges }
    };
    
    console.log('📊 Frontend: Updated strategy structure', {
      strategyId: id,
      nodeStructure: nodes?.map(node => ({
        id: node.id,
        type: node.type,
        dataKeys: Object.keys(node.data || {})
      })) || [],
      edgeStructure: edges?.map(edge => ({
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle
      })) || []
    });
    
    try {
      const response = await this.request<{ success: boolean; data: any; message: string }>(`/api/strategies/${id}`, {
        method: 'PUT',
        body: JSON.stringify(requestBody),
      });
      
      console.log('✅ Frontend: Strategy update response', {
        strategyId: id,
        success: response.success,
        message: response.message
      });
      
      return {
        success: response.success,
        id: id, // Use the passed ID for updates
        message: response.message
      };
    } catch (error) {
      console.error('❌ Frontend: Strategy update failed', {
        strategyId: id,
        error: error.message,
        strategyName: data.name
      });
      throw error;
    }
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

  // Enhanced Backtesting with Job Queue System
  async runBacktest(data: BacktestRequest): Promise<BacktestResponse> {
    console.log('📊 Frontend: Submitting backtest job', {
      strategy_id: data.strategy_id,
      symbol: data.ticker,
      dateRange: `${data.fromDate} to ${data.toDate}`,
      interval: data.interval
    });
    
    return this.request('/api/backtest/run', {
      method: 'POST',
      body: JSON.stringify({
        strategy_id: data.strategy_id,
        symbol: data.ticker,
        start_date: data.fromDate,
        end_date: data.toDate,
        interval: data.interval
      }),
    });
  }

  async getBacktestResult(jobId: string): Promise<any> {
    console.log('📈 Frontend: Getting backtest result', jobId);
    return this.request(`/api/backtest/${jobId}`);
  }

  async listBacktestJobs(params?: { 
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<any> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.offset) searchParams.append('offset', params.offset.toString());
    if (params?.status) searchParams.append('status_filter', params.status);
    
    const query = searchParams.toString();
    return this.request(`/api/backtest/${query ? `?${query}` : ''}`);
  }

  async cancelBacktest(jobId: string): Promise<any> {
    console.log('❌ Frontend: Cancelling backtest', jobId);
    return this.request(`/api/backtest/${jobId}`, {
      method: 'DELETE'
    });
  }

  async getBacktestMetrics(jobId: string): Promise<any> {
    console.log('📊 Frontend: Getting backtest metrics', jobId);
    return this.request(`/api/backtest/${jobId}/metrics`);
  }

  // Forward Testing (Multi-Session Architecture)
  async createForwardTestSession(data: { name: string; strategy: any; settings: any }): Promise<{ success: boolean; session_id: string; message: string }> {
    return this.request('/api/forward-test/', {
      method: 'POST',
      headers: {},
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
      headers: {}
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
      headers: {}
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
      headers: {}
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
      headers: {},
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

  // Portfolio Management - New real-time endpoints
  async getPortfolioSummary(sessionId: string): Promise<any> {
    return this.request(`/api/forward-testing/${sessionId}/portfolio`);
  }

  async getSessionMetrics(sessionId: string): Promise<any> {
    return this.request(`/api/forward-testing/${sessionId}/metrics`);
  }

  async getSessionTrades(sessionId: string, limit: number = 50): Promise<any> {
    return this.request(`/api/forward-testing/${sessionId}/trades?limit=${limit}`);
  }

  async getSessionChartData(sessionId: string, limit: number = 1000): Promise<any> {
    return this.request(`/api/forward-testing/${sessionId}/chart?limit=${limit}`);
  }

  // Market Data - Enhanced endpoints
  async getLatestPrices(symbol: string, limit: number = 100): Promise<any> {
    return this.request(`/api/market/symbols/${symbol}/latest?limit=${limit}`);
  }

  async subscribeToSymbol(symbol: string): Promise<any> {
    return this.request(`/api/market/symbols/${symbol}/subscribe`, {
      method: 'POST'
    });
  }

  async unsubscribeFromSymbol(symbol: string): Promise<any> {
    return this.request(`/api/market/symbols/${symbol}/unsubscribe`, {
      method: 'DELETE'
    });
  }

  async validateSymbolAndDates(data: { symbol: string; start_date: string; end_date: string }): Promise<any> {
    return this.request('/api/market/validate', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getSymbolDateRange(symbol: string): Promise<any> {
    return this.request(`/api/market/symbols/${symbol}/date-range`);
  }

  // Notification Service Integration
  async getNotificationConnections(): Promise<any> {
    return this.request('/api/notifications/connections');
  }

  async sendUserNotification(userId: string, notification: any): Promise<any> {
    return this.request(`/api/notifications/notify/user/${userId}`, {
      method: 'POST',
      body: JSON.stringify(notification)
    });
  }

  async broadcastNotification(notification: any): Promise<any> {
    return this.request('/api/notifications/notify/broadcast', {
      method: 'POST',
      body: JSON.stringify(notification)
    });
  }

  // Service Health Checks
  async getServiceHealth(service?: string): Promise<any> {
    const endpoint = service ? `/api/${service}/health` : '/api/health';
    return this.request(endpoint);
  }

  async getDetailedHealth(): Promise<any> {
    return this.request('/api/health/detailed');
  }

}

export const apiService = new ApiService();