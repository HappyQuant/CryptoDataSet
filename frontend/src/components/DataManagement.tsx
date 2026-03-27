import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, message, Space, Select } from 'antd';

import axios from 'axios';
import { useLanguage } from '../i18n/LanguageContext';

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
  const { t } = useLanguage();
  const [data, setData] = useState<KlineDataInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [config, setConfig] = useState<ConfigData>({ symbols: [], intervals: [] });
  const [filterSymbol, setFilterSymbol] = useState<string | undefined>(undefined);
  const [filterInterval, setFilterInterval] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/config');
      setConfig(response.data);
    } catch (error: any) {
      message.error('Failed to load config: ' + (error.response?.data?.message || error.message));
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
      message.error('Failed to load data: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleString();
  };

  const columns = [
    {
      title: t.management.symbol,
      dataIndex: 'symbol',
      key: 'symbol',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: t.management.interval,
      dataIndex: 'interval',
      key: 'interval',
      render: (text: string) => <Tag color="green">{text}</Tag>,
    },
    {
      title: t.management.records,
      dataIndex: 'total_count',
      key: 'total_count',
      render: (text: number) => text.toLocaleString(),
    },
    {
      title: t.management.startTime,
      dataIndex: 'earliest_time',
      key: 'earliest_time',
      render: (text: number | null) => formatTime(text),
    },
    {
      title: t.management.endTime,
      dataIndex: 'latest_time',
      key: 'latest_time',
      render: (text: number | null) => formatTime(text),
    },
  ];

  return (
    <Card
      className="data-management-card"
      title={t.management.title}
      bordered={false}
      loading={configLoading}
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }} className="filter-section">
        <Space wrap>
          <Select
            placeholder={t.management.filterSymbol}
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
            placeholder={t.management.filterInterval}
            value={filterInterval}
            onChange={(value) => setFilterInterval(value)}
            style={{ width: 140 }}
            allowClear
          >
            {config.intervals.map(interval => (
              <Option key={interval} value={interval}>{interval}</Option>
            ))}
          </Select>
          <Button onClick={fetchData}>{t.management.query}</Button>
          <Button onClick={() => { setFilterSymbol(undefined); setFilterInterval(undefined); }}>{t.management.reset}</Button>
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
          showTotal: (total) => t.management.total.replace('{total}', String(total)),
        }}
        className="data-table"
      />
    </Card>
  );
};

export default DataManagement;
