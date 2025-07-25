# Wire-Trader Frontend

A modern Vue.js frontend for the Wire-Trader cryptocurrency trading platform.

## Overview

This frontend provides a comprehensive interface for the Wire-Trader platform, allowing users to:

- **Authentication**: Secure login and registration with JWT tokens
- **Dashboard**: Portfolio overview with real-time data
- **Exchange Management**: Connect and manage multiple cryptocurrency exchanges
- **Trading Interface**: Place orders and monitor trades
- **Real-time Data**: WebSocket integration for live market updates

## Technology Stack

- **Vue 3** with Composition API and TypeScript
- **Vite** for build tooling and development server
- **Vue Router** for client-side routing
- **Pinia** for state management
- **TailwindCSS** for responsive styling
- **Axios** for HTTP API communication
- **WebSocket** for real-time data streaming

## Project Structure

```
frontend/
├── public/                 # Static assets
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── common/        # Generic components (buttons, inputs, cards)
│   │   └── layout/        # Layout components (navigation, headers)
│   ├── views/             # Page components
│   │   ├── Auth/          # Authentication pages
│   │   ├── Dashboard.vue  # Main dashboard
│   │   ├── Exchanges.vue  # Exchange management
│   │   └── Trading.vue    # Trading interface
│   ├── stores/            # Pinia state stores
│   │   ├── auth.ts        # Authentication state
│   │   └── exchanges.ts   # Exchange management state
│   ├── services/          # API service layer
│   │   ├── api.ts         # HTTP client configuration
│   │   ├── auth.ts        # Authentication API calls
│   │   ├── exchanges.ts   # Exchange API calls
│   │   └── websocket.ts   # WebSocket client
│   ├── composables/       # Reusable composition functions
│   │   └── useWebSocket.ts # WebSocket composables
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts       # Application types
│   ├── router/            # Vue Router configuration
│   └── assets/            # Stylesheets and assets
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Features Implemented

### ✅ Authentication System
- User login and registration
- JWT token management with automatic refresh
- Protected routes with navigation guards
- Secure token storage and validation

### ✅ Dashboard
- Portfolio overview with key metrics
- Connected exchange status
- Real-time balance display
- Quick action buttons
- Responsive card-based layout

### ✅ Exchange Management
- Support for multiple exchanges (Binance, Coinbase, Kraken, KuCoin)
- Secure API key connection with sandbox mode
- Connection testing and status monitoring
- Exchange disconnection with confirmation
- Real-time connection status updates

### ✅ Trading Interface
- Order placement form with multiple order types
- Market data display (placeholder for real-time integration)
- Order book preview (placeholder for real-time data)
- Support for market, limit, and stop orders
- Exchange selection and symbol input

### ✅ Real-time Integration
- WebSocket service for live data streaming
- Composables for easy WebSocket integration
- Market data subscriptions (ticker, orderbook)
- Automatic reconnection handling
- Message type-based event handling

### ✅ UI/UX Features
- Responsive design optimized for desktop and mobile
- Modern, clean interface with TailwindCSS
- Loading states and error handling
- Form validation and user feedback
- Consistent component design system

## API Integration

The frontend integrates with the Wire-Trader backend APIs:

- **Authentication**: `/api/auth/*` - Login, register, profile management
- **Exchanges**: `/api/exchanges/*` - Exchange connections and balances
- **Trading**: `/api/trading/*` - Order placement and management
- **Market Data**: `/api/market/*` - Real-time market information
- **WebSocket**: `ws://localhost:3000/ws` - Real-time data streaming

## Development

### Prerequisites
- Node.js 18+
- npm 8+
- Wire-Trader backend running on port 3000

### Setup
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
```
The frontend will be available at `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Linting
```bash
npm run lint
```

## Configuration

### Environment Variables
Create a `.env` file in the frontend directory for custom configuration:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws
```

### Proxy Configuration
The Vite development server is configured to proxy API requests to the backend:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

## Security Considerations

- JWT tokens are stored in localStorage with expiration validation
- API keys are never stored in frontend code
- All API requests include proper authentication headers
- HTTPS-only communication in production
- Input validation and sanitization

## Future Enhancements

The current implementation provides a solid foundation for the following planned features:

- **Paper Trading Interface**: Separate simulation environment
- **Advanced Analytics**: Performance charts and metrics
- **Portfolio Management**: Advanced portfolio tools and rebalancing
- **Advanced Order Types**: OCO, trailing stops, iceberg orders
- **Mobile App**: React Native mobile application
- **Real-time Charts**: TradingView integration
- **Notifications**: Push notifications for orders and price alerts

## Contributing

1. Follow the existing code style and patterns
2. Use TypeScript for all new code
3. Add proper error handling and loading states
4. Ensure responsive design compatibility
5. Update this README for significant changes

## Architecture Decisions

### State Management
- **Pinia** for global state management
- **Composables** for shared logic and reusable functionality
- **Local state** for component-specific data

### API Communication
- **Axios** with interceptors for consistent error handling
- **Service layer** abstraction for easy API management
- **TypeScript types** for all API responses

### Styling
- **TailwindCSS** for utility-first styling
- **Component classes** for reusable UI patterns
- **Responsive design** with mobile-first approach

### Real-time Data
- **WebSocket service** with automatic reconnection
- **Composables** for easy component integration
- **Type-safe** message handling

This frontend implementation provides a modern, secure, and scalable foundation for the Wire-Trader cryptocurrency trading platform.