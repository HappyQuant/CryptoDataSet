# Crypto Quantitative Data Management【SPOT】

Cryptocurrency K-Line data collection and management platform, supporting Binance spot market data.

## Features

### Data Collection
- Multiple trading pairs (BTCUSDT, ETHUSDT, BNBUSDT, etc.)
- Multiple K-Line intervals (1m, 5m, 15m, 1h, 4h, 1d, etc.)
- Automatic gap detection and backfilling
- Real-time task progress monitoring

### Data Management
- View collected data statistics
- Filter by trading pair and K-Line interval
- Display data time range

### K-Line Chart
- TradingView lightweight-charts rendering
- 13 Technical indicators:
  - Volume (VOL)
  - MACD
  - RSI
  - KDJ
  - Bollinger Bands (BOLL)
  - CCI
  - Williams %R (WR)
  - ATR
  - ADX
  - SAR
  - OBV
  - MFI
  - Stochastic (Stoch)
- Toggle MA5/MA10/MA20/MA60 moving averages
- Jump to specific time

### UI/UX
- Light/Dark theme toggle
- Chinese/English language switch
- Responsive layout

## Tech Stack

### Frontend
- React 18 + TypeScript
- Ant Design 5
- TradingView lightweight-charts v5
- dayjs for date handling

### Backend
- FastAPI (Python 3.10+)
- SQLAlchemy + asyncpg (async database)
- PostgreSQL database
- Redis (optional, for caching)

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- npm or yarn

### Installation

#### 1. Clone the project
```bash
git clone <repository-url>
cd CryptoDataSet
```

#### 2. Install frontend dependencies
```bash
cd frontend
npm install
```

#### 3. Install backend dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### 4. Configure database

Create PostgreSQL database:
```sql
CREATE DATABASE crypto_kline;
```

Set environment variable or modify `backend/app/core/config.py`:
```python
DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/crypto_kline"
```

#### 5. Initialize database tables
```bash
cd backend
python -c "from app.core.database import engine, Base; import asyncio; asyncio.run(Base.metadata.create_all(engine))"
```

#### 6. Start backend server
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 7. Start frontend dev server
```bash
cd frontend
npm start
```

Visit http://localhost:3000 to view the application.

## Project Structure

```
CryptoDataSet/
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── DataCollection.tsx   # Data collection
│   │   │   ├── DataManagement.tsx   # Data management
│   │   │   └── KlineChart.tsx       # K-Line chart
│   │   ├── contexts/           # React Context
│   │   │   └── ThemeContext.tsx     # Theme context
│   │   ├── i18n/               # Internationalization
│   │   │   ├── locales.ts           # Language files
│   │   │   └── LanguageContext.tsx   # Language context
│   │   ├── App.tsx             # Main app component
│   │   └── App.css              # Global styles
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py        # API routes
│   │   ├── core/
│   │   │   ├── config.py        # Configuration
│   │   │   ├── database.py      # Database connection
│   │   │   ├── middleware.py    # Middleware (logging, monitoring)
│   │   │   └── rate_limit.py    # Rate limiting
│   │   ├── services/
│   │   │   ├── binance_service.py  # Binance API
│   │   │   ├── kline_service.py     # K-Line service
│   │   │   └── task_manager.py      # Task management
│   │   └── main.py              # FastAPI entry point
│   └── requirements.txt
└── README.md
```

## API Documentation

After starting the backend server:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Main Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/config` | Get config (symbols, intervals list) |
| GET | `/api/tasks` | Get task list |
| POST | `/api/kline/collect` | Trigger data collection |
| GET | `/api/kline/{symbol}/{interval}/info` | Get data statistics |
| GET | `/api/kline/{symbol}/{interval}/previous` | Get historical K-Lines |
| GET | `/api/kline/{symbol}/{interval}/next` | Get future K-Lines |
| GET | `/health` | Health check |
| GET | `/metrics` | Monitoring metrics |

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL database connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/crypto_kline` |
| `BINANCE_PROXY` | Binance API proxy address (required in some regions like mainland China) | `http://127.0.0.1:1080` |

Configure in `backend/.env` file:
```bash
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/crypto_kline
BINANCE_PROXY=http://127.0.0.1:1080
```

### Trading Pairs
Modify `CONFIG_SYMBOLS` in `backend/app/api/routes.py`:
```python
CONFIG_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
    "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT",
]
```

### K-Line Intervals
Modify `CONFIG_INTERVALS` in `backend/app/api/routes.py`:
```python
CONFIG_INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]
```

## Monitoring & Logging

### Health Check
```bash
curl http://localhost:8000/health
```

### Metrics
```bash
curl http://localhost:8000/metrics
```

### View Logs
Backend logs are output to console, including:
- Request logs (method, path, status code, response time)
- Collection progress logs
- Error logs

## License

MIT License
