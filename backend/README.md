# Crypto Kline Data Service

Crypto量化回测数据基础设施后端服务

## 技术栈

- FastAPI
- SQLAlchemy (异步)
- PostgreSQL
- Redis
- Pipenv

## 安装

1. 安装依赖
```bash
cd backend
pipenv install
```

2. 配置环境变量
编辑 `.env` 文件：
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crypto_kline
REDIS_URL=redis://localhost:6379/0
BINANCE_API_URL=https://api.binance.com
```

3. 启动服务
```bash
pipenv run uvicorn app.main:app --reload
```

## API接口

### 数据采集
- `POST /api/kline/collect` - 触发K线数据采集

### 数据管理
- `GET /api/kline/info` - 获取K线数据信息统计

### 数据查询
- `GET /api/kline/{symbol}/{interval}/previous` - 获取指定时间之前的K线数据
- `GET /api/kline/{symbol}/{interval}/next` - 获取指定时间之后的K线数据

## 数据库表结构

表名规则：`t_kline_{symbol}_{interval}`

字段：
- open_time (主键)
- close_time
- open_price
- close_price
- high_price
- low_price
- base_volume
- quote_volume
- trades_count
- taker_buy_base_volume
- taker_buy_quote_volume
- reserved
