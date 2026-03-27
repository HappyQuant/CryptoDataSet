import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, message, Space, Select } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Option } = Select;

interface KlineDataInfo {
  symbol: string;
  interval: string;
  total_count: number;
  earliest_time: number | null;
  latest_time: number | null;
}

interface ConfigData {
  symbols: string[];
  intervals: string[];
}

const DataManagement: React.FC = () => {
  const [data, setData] = useState<KlineDataInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [config, setConfig] = useState<ConfigData>({ symbols: [], intervals: [] });
  const [filterSymbol, setFilterSymbol] = useState<string | undefined>(undefined);
  const [filterInterval, setFilterInterval] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/config');
      setConfig(response.data);
    } catch (error: any) {
      message.error('获取配置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filterSymbol) params.symbol = filterSymbol;
      if (filterInterval) params.interval = filterInterval;
      
      const response = await axios.get('http://127.0.0.1:8000/api/kline/info', { params });
      setData(response.data.data);
    } catch (error: any) {
      message.error('获取数据失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const columns = [
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: 'K线间隔',
      dataIndex: 'interval',
      key: 'interval',
      render: (text: string) => <Tag color="green">{text}</Tag>,
    },
    {
      title: '数据条数',
      dataIndex: 'total_count',
      key: 'total_count',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: '最早时间',
      dataIndex: 'earliest_time',
      key: 'earliest_time',
      render: (text: number | null) => formatTime(text),
    },
    {
      title: '最晚时间',
      dataIndex: 'latest_time',
      key: 'latest_time',
      render: (text: number | null) => formatTime(text),
    },
  ];

  return (
    <Card
      className="data-management-card"
      title="K线数据管理"
      bordered={false}
      loading={configLoading}
      extra={
        <Button type="primary" onClick={fetchData} loading={loading} icon={<SyncOutlined />}>
          刷新
        </Button>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }} className="filter-section">
        <Space wrap>
          <Select
            placeholder="筛选交易对"
            value={filterSymbol}
            onChange={(value) => setFilterSymbol(value)}
            style={{ width: 160 }}
            allowClear
          >
            {config.symbols.map(symbol => (
              <Option key={symbol} value={symbol}>{symbol}</Option>
            ))}
          </Select>
          <Select
            placeholder="筛选K线间隔"
            value={filterInterval}
            onChange={(value) => setFilterInterval(value)}
            style={{ width: 140 }}
            allowClear
          >
            {config.intervals.map(interval => (
              <Option key={interval} value={interval}>{interval}</Option>
            ))}
          </Select>
          <Button onClick={fetchData}>查询</Button>
          <Button onClick={() => { setFilterSymbol(undefined); setFilterInterval(undefined); }}>重置</Button>
        </Space>
      </Space>

      <Table
        columns={columns}
        dataSource={data}
        rowKey={(record) => `${record.symbol}_${record.interval}`}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条记录`,
        }}
        className="data-table"
      />
    </Card>
  );
};

export default DataManagement;
