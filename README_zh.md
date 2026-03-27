# Crypto量化数据管理平台【SPOT】

加密货币 K 线数据采集与管理平台，支持 Binance 现货市场数据。

## 功能特性

### 数据采集
- 支持多种交易对（BTCUSDT, ETHUSDT, BNBUSDT 等）
- 支持多种 K 线间隔（1m, 5m, 15m, 1h, 4h, 1d 等）
- 自动检测并补采数据断档
- 实时任务进度监控

### 数据管理
- 查看已采集数据统计
- 按交易对和 K 线间隔筛选数据
- 显示数据时间范围

### K 线图表
- 使用 TradingView lightweight-charts 渲染
- 支持 13 种技术指标：
  - 成交量 (VOL)
  - MACD
  - RSI
  - KDJ
  - 布林带 (BOLL)
  - CCI
  - 威廉指标 (WR)
  - ATR
  - ADX
  - SAR
  - OBV
  - MFI
  - 随机指标 (Stoch)
- 可切换显示 MA5/MA10/MA20/MA60 均线
- 支持跳转到指定时间

### UI/UX
- 亮色/暗色主题切换
- 中英文语言切换
- 响应式布局

## 技术栈

### 前端
- React 18 + TypeScript
- Ant Design 5
- TradingView lightweight-charts v5
- dayjs 时间处理

### 后端
- FastAPI (Python 3.10+)
- SQLAlchemy + asyncpg (异步数据库)
- PostgreSQL 数据库
- Redis (可选，用于缓存)

## 快速开始

### 前置条件
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- npm 或 yarn

### 安装

#### 1. 克隆项目
```bash
git clone <repository-url>
cd CryptoDataSet
```

#### 2. 安装前端依赖
```bash
cd frontend
npm install
```

#### 3. 安装后端依赖
```bash
cd backend
pip install -r requirements.txt
```

#### 4. 配置数据库

创建 PostgreSQL 数据库：
```sql
CREATE DATABASE crypto_kline;
```

配置环境变量或修改 `backend/app/core/config.py`：
```python
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/crypto_kline"
```

#### 5. 初始化数据库表
```bash
cd backend
python -c "from app.core.database import engine, Base; import asyncio; asyncio.run(Base.metadata.create_all(engine))"
```

#### 6. 启动后端服务
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### 7. 启动前端开发服务器
```bash
cd frontend
npm start
```

访问 http://localhost:3000 查看应用。

## 项目结构

```
CryptoDataSet/
├── frontend/
│   ├── src/
│   │   ├── components/        # React 组件
│   │   │   ├── DataCollection.tsx   # 数据采集
│   │   │   ├── DataManagement.tsx   # 数据管理
│   │   │   └── KlineChart.tsx       # K线图表
│   │   ├── contexts/           # React Context
│   │   │   └── ThemeContext.tsx     # 主题上下文
│   │   ├── i18n/               # 国际化
│   │   │   ├── locales.ts           # 语言文件
│   │   │   └── LanguageContext.tsx   # 语言上下文
│   │   ├── App.tsx             # 主应用组件
│   │   └── App.css              # 全局样式
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py        # API 路由
│   │   ├── core/
│   │   │   ├── config.py        # 配置
│   │   │   ├── database.py      # 数据库连接
│   │   │   ├── middleware.py    # 中间件（日志、监控）
│   │   │   └── rate_limit.py    # 限流
│   │   ├── services/
│   │   │   ├── binance_service.py  # Binance API
│   │   │   ├── kline_service.py     # K线服务
│   │   │   └── task_manager.py      # 任务管理
│   │   └── main.py              # FastAPI 入口
│   └── requirements.txt
└── README.md
```

## API 文档

启动后端服务后访问：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 主要接口

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/config` | 获取配置（交易对、K线间隔列表） |
| GET | `/api/tasks` | 获取任务列表 |
| POST | `/api/kline/collect` | 触发数据采集 |
| GET | `/api/kline/{symbol}/{interval}/info` | 获取数据统计 |
| GET | `/api/kline/{symbol}/{interval}/previous` | 获取历史K线 |
| GET | `/api/kline/{symbol}/{interval}/next` | 获取未来K线 |
| GET | `/health` | 健康检查 |
| GET | `/metrics` | 监控指标 |

## 配置说明

### 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 数据库连接字符串 | `postgresql://postgres:postgres@localhost:5432/crypto_kline` |
| `BINANCE_PROXY` | Binance API 代理地址（在中国大陆等地区访问时需要） | `http://127.0.0.1:1080` |

在 `backend/.env` 文件中配置：
```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crypto_kline
BINANCE_PROXY=http://127.0.0.1:1080
```

### 交易对配置
修改 `backend/app/api/routes.py` 中的 `CONFIG_SYMBOLS`:
```python
CONFIG_SYMBOLS = [
    "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
    "ADAUSDT", "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "MATICUSDT",
]
```

### K线间隔配置
修改 `backend/app/api/routes.py` 中的 `CONFIG_INTERVALS`:
```python
CONFIG_INTERVALS = ["1m", "3m", "5m", "15m", "30m", "1h", "2h", "4h", "6h", "8h", "12h", "1d", "3d", "1w", "1M"]
```

## 监控与日志

### 健康检查
```bash
curl http://localhost:8000/health
```

### 监控指标
```bash
curl http://localhost:8000/metrics
```

### 查看日志
后端服务日志会输出到控制台，包含：
- 请求日志（方法、路径、状态码、响应时间）
- 采集进度日志
- 错误日志

## 许可证

MIT License
