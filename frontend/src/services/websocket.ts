/**
 * Real-time WebSocket service for AlgoTrade
 * Connects to Notification Service for live updates
 */

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: number;
  session_id?: string;
  user_id?: string;
  message?: string;
}

export interface WebSocketConfig {
  url: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export type MessageHandler = (message: WebSocketMessage) => void;
export type ConnectionStateHandler = (connected: boolean) => void;
export type ErrorHandler = (error: Error) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private config: WebSocketConfig | null = null;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private connectionStateHandlers: ConnectionStateHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private subscriptions: Set<string> = new Set();

  /**
   * Connect to the WebSocket service
   */
  async connect(config: WebSocketConfig): Promise<void> {
    this.config = config;
    this.reconnectAttempts = 0;
    
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = `${config.url}?token=${encodeURIComponent(config.token)}`;
        console.log('🔌 WebSocket: Connecting to', wsUrl.replace(config.token, '***'));
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket: Connected successfully');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.notifyConnectionState(true);
          
          // Re-subscribe to previous sessions
          this.resubscribe();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('📨 WebSocket: Received message', {
              type: message.type,
              hasData: !!message.data,
              sessionId: message.session_id
            });
            
            this.handleMessage(message);
          } catch (error) {
            console.error('❌ WebSocket: Failed to parse message', error);
            this.notifyError(new Error('Failed to parse WebSocket message'));
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket: Connection error', error);
          this.notifyError(new Error('WebSocket connection error'));
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket: Connection closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
          });
          
          this.connected = false;
          this.stopHeartbeat();
          this.notifyConnectionState(false);
          
          // Only attempt reconnection if not a clean close
          if (!event.wasClean && this.config && this.reconnectAttempts < (this.config.maxReconnectAttempts || 10)) {
            this.scheduleReconnect();
          }
        };

      } catch (error) {
        console.error('❌ WebSocket: Failed to create connection', error);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    console.log('🔌 WebSocket: Disconnecting...');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.connected = false;
    this.subscriptions.clear();
    this.notifyConnectionState(false);
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Subscribe to session updates
   */
  async subscribeToSession(sessionId: string): Promise<void> {
    if (!this.isConnected()) {
      console.warn('⚠️ WebSocket: Not connected, storing subscription for later');
      this.subscriptions.add(sessionId);
      return;
    }

    const message = {
      type: 'subscribe',
      session_id: sessionId
    };

    try {
      this.ws!.send(JSON.stringify(message));
      this.subscriptions.add(sessionId);
      console.log('📡 WebSocket: Subscribed to session', sessionId);
    } catch (error) {
      console.error('❌ WebSocket: Failed to subscribe to session', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from session updates
   */
  async unsubscribeFromSession(sessionId: string): Promise<void> {
    if (!this.isConnected()) {
      this.subscriptions.delete(sessionId);
      return;
    }

    const message = {
      type: 'unsubscribe',
      session_id: sessionId
    };

    try {
      this.ws!.send(JSON.stringify(message));
      this.subscriptions.delete(sessionId);
      console.log('📡 WebSocket: Unsubscribed from session', sessionId);
    } catch (error) {
      console.error('❌ WebSocket: Failed to unsubscribe from session', error);
    }
  }

  /**
   * Add message handler for specific message types
   */
  addMessageHandler(messageType: string, handler: MessageHandler): void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType)!.push(handler);
    
    console.log('🎯 WebSocket: Added message handler', {
      messageType,
      handlerCount: this.messageHandlers.get(messageType)!.length
    });
  }

  /**
   * Remove message handler
   */
  removeMessageHandler(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        console.log('🗑️ WebSocket: Removed message handler', messageType);
      }
    }
  }

  /**
   * Add connection state handler
   */
  addConnectionStateHandler(handler: ConnectionStateHandler): void {
    this.connectionStateHandlers.push(handler);
    // Immediately notify current state
    handler(this.connected);
  }

  /**
   * Remove connection state handler
   */
  removeConnectionStateHandler(handler: ConnectionStateHandler): void {
    const index = this.connectionStateHandlers.indexOf(handler);
    if (index !== -1) {
      this.connectionStateHandlers.splice(index, 1);
    }
  }

  /**
   * Add error handler
   */
  addErrorHandler(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Remove error handler
   */
  removeErrorHandler(handler: ErrorHandler): void {
    const index = this.errorHandlers.indexOf(handler);
    if (index !== -1) {
      this.errorHandlers.splice(index, 1);
    }
  }

  /**
   * Send ping to server
   */
  ping(): void {
    if (this.isConnected()) {
      const message = {
        type: 'ping',
        timestamp: Date.now()
      };
      
      try {
        this.ws!.send(JSON.stringify(message));
        console.log('🏓 WebSocket: Sent ping');
      } catch (error) {
        console.error('❌ WebSocket: Failed to send ping', error);
      }
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts,
      subscriptions: Array.from(this.subscriptions),
      messageHandlers: Array.from(this.messageHandlers.keys()),
      readyState: this.ws?.readyState
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    // Handle built-in message types
    switch (message.type) {
      case 'welcome':
        console.log('👋 WebSocket: Received welcome message', message.message);
        break;
        
      case 'ping':
        // Respond to server ping with pong
        this.sendPong();
        break;
        
      case 'pong':
        console.log('🏓 WebSocket: Received pong');
        break;
        
      case 'error':
        console.error('❌ WebSocket: Server error', message.message);
        this.notifyError(new Error(message.message || 'Server error'));
        break;
    }

    // Notify registered handlers
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('❌ WebSocket: Message handler error', error);
        }
      });
    } else if (message.type !== 'welcome' && message.type !== 'pong') {
      // Only warn for unexpected message types, not welcome/pong
      console.log('⚠️ WebSocket: No handlers for message type', message.type);
    }
  }

  private sendPong(): void {
    if (this.isConnected()) {
      const message = {
        type: 'pong',
        timestamp: Date.now()
      };
      
      try {
        this.ws!.send(JSON.stringify(message));
        console.log('🏓 WebSocket: Sent pong');
      } catch (error) {
        console.error('❌ WebSocket: Failed to send pong', error);
      }
    }
  }

  private startHeartbeat(): void {
    const interval = this.config?.heartbeatInterval || 30000; // 30 seconds
    
    this.heartbeatTimer = setInterval(() => {
      this.ping();
    }, interval);
    
    console.log('💓 WebSocket: Started heartbeat', { interval });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      console.log('💓 WebSocket: Stopped heartbeat');
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    console.log('🔄 WebSocket: Scheduling reconnect', {
      attempt: this.reconnectAttempts + 1,
      delay: `${delay}ms`
    });
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      
      try {
        await this.connect(this.config!);
      } catch (error) {
        console.error('❌ WebSocket: Reconnect failed', error);
        
        if (this.reconnectAttempts < (this.config!.maxReconnectAttempts || 10)) {
          this.scheduleReconnect();
        } else {
          console.error('💀 WebSocket: Max reconnect attempts reached');
          this.notifyError(new Error('Max reconnect attempts reached'));
        }
      }
    }, delay);
  }

  private resubscribe(): void {
    // Re-subscribe to all sessions after reconnection
    this.subscriptions.forEach(sessionId => {
      this.subscribeToSession(sessionId).catch(error => {
        console.error('❌ WebSocket: Failed to resubscribe to session', sessionId, error);
      });
    });
  }

  private notifyConnectionState(connected: boolean): void {
    this.connectionStateHandlers.forEach(handler => {
      try {
        handler(connected);
      } catch (error) {
        console.error('❌ WebSocket: Connection state handler error', error);
      }
    });
  }

  private notifyError(error: Error): void {
    this.errorHandlers.forEach(handler => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('❌ WebSocket: Error handler error', handlerError);
      }
    });
  }
}

// Singleton instance
export const webSocketService = new WebSocketService();

// Default configuration
export const defaultWebSocketConfig = {
  url: 'ws://localhost:8005/ws', // Notification Service WebSocket endpoint
  reconnectInterval: 5000,
  maxReconnectAttempts: 10,
  heartbeatInterval: 30000
};

// Message type constants
export const MESSAGE_TYPES = {
  // System messages
  WELCOME: 'welcome',
  PING: 'ping',
  PONG: 'pong',
  ERROR: 'error',
  
  // Forward testing events
  FORWARD_TEST_EVENT: 'forward_test_event',
  PORTFOLIO_UPDATE: 'portfolio_update',
  TRADE_EXECUTION: 'trade_execution',
  STRATEGY_SIGNAL: 'strategy_signal',
  REALTIME_UPDATE: 'realtime_update'
} as const;