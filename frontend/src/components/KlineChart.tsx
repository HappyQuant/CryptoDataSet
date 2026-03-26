import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Form, Select, Button, message, Space, DatePicker } from 'antd';
import { init, dispose } from 'klinecharts';
import axios from 'axios';
import dayjs from 'dayjs';

const { Option } = Select;

interface KlineDataItem {
  open_time: number;
  close_time: number;
  open_price: string;
  close_price: string;
  high_price: string;
  low_price: string;
  base_volume: string;
  quote_volume: string;
  trades_count: number;
  taker_buy_base_volume: string;
  taker_buy_quote_volume: string;
}

interface ConfigData {
  symbols: string[];
  intervals: string[];
}

const KlineChart: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [config, setConfig] = useState<ConfigData>({ symbols: [], intervals: [] });
  
  const dataRangeRef = useRef<{
    symbol: string;
    interval: string;
    earliestTime: number | null;
    latestTime: number | null;
  }>({ symbol: '', interval: '', earliestTime: null, latestTime: null });

  useEffect(() => {
    if (!chartContainerRef.current) return;
    
    const container = chartContainerRef.current;
    container.style.width = '100%';
    container.style.height = '500px';
    
    if (!chartInstanceRef.current) {
      chartInstanceRef.current = init(container);
    }

    return () => {
      if (chartInstanceRef.current && container) {
        dispose(container);
        chartInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/config');
      setConfig(response.data);
      if (response.data.symbols.length > 0 && response.data.intervals.length > 0) {
        form.setFieldsValue({
          symbol: response.data.symbols[0],
          interval: response.data.intervals[0],
          limit: 500,
        });
      }
    } catch (error: any) {
      message.error('获取配置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setConfigLoading(false);
    }
  };

  const loadMoreHistoryData = async () => {
    if (!dataRangeRef.current.earliestTime || !chartInstanceRef.current) return;
    
    const { symbol, interval } = dataRangeRef.current;
    const limit = form.getFieldValue('limit') || 500;
    
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/previous`, {
        params: {
          endTime: dataRangeRef.current.earliestTime,
          limit
        }
      });

      const klineData: KlineDataItem[] = response.data;
      
      if (klineData.length === 0) {
        message.info('没有更多历史数据了');
        return;
      }

      const chartData = klineData.map((item) => ({
        timestamp: item.open_time,
        open: parseFloat(item.open_price),
        high: parseFloat(item.high_price),
        low: parseFloat(item.low_price),
        close: parseFloat(item.close_price),
        volume: parseFloat(item.base_volume),
      }));

      chartInstanceRef.current?.updateData(chartData, 'prepend');
      
      if (klineData.length > 0) {
        dataRangeRef.current.earliestTime = klineData[0].open_time;
      }
      
      message.success(`已加载 ${chartData.length} 条更多历史数据`);
    } catch (error: any) {
      message.error('加载历史数据失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const loadMoreFutureData = async () => {
    if (!dataRangeRef.current.latestTime || !chartInstanceRef.current) return;
    
    const { symbol, interval } = dataRangeRef.current;
    const limit = form.getFieldValue('limit') || 500;
    
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/next`, {
        params: {
          fromTime: dataRangeRef.current.latestTime + 1,
          limit
        }
      });

      const klineData: KlineDataItem[] = response.data;
      
      if (klineData.length === 0) {
        message.info('没有更多未来数据了');
        return;
      }

      const chartData = klineData.map((item) => ({
        timestamp: item.open_time,
        open: parseFloat(item.open_price),
        high: parseFloat(item.high_price),
        low: parseFloat(item.low_price),
        close: parseFloat(item.close_price),
        volume: parseFloat(item.base_volume),
      }));

      chartInstanceRef.current?.updateData(chartData, 'append');
      
      if (klineData.length > 0) {
        dataRangeRef.current.latestTime = klineData[klineData.length - 1].open_time;
      }
      
      message.success(`已加载 ${chartData.length} 条更多未来数据`);
    } catch (error: any) {
      message.error('加载未来数据失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const loadData = async (values: any) => {
    if (!chartInstanceRef.current) {
      message.error('图表未初始化');
      return;
    }

    setLoading(true);
    try {
      const symbol = values.symbol.toUpperCase();
      const interval = values.interval;
      const endTime = values.end_time ? dayjs(values.end_time).valueOf() : Date.now();
      const limit = values.limit || 500;

      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/previous`, {
        params: {
          endTime,
          limit
        }
      });

      const klineData: KlineDataItem[] = response.data;
      
      if (klineData.length === 0) {
        message.warning('未找到数据，请先采集数据');
        setLoading(false);
        return;
      }

      const chartData = klineData.map((item) => ({
        timestamp: item.open_time,
        open: parseFloat(item.open_price),
        high: parseFloat(item.high_price),
        low: parseFloat(item.low_price),
        close: parseFloat(item.close_price),
        volume: parseFloat(item.base_volume),
      }));

      console.log('Chart data sample:', JSON.stringify(chartData[0]));
      console.log('Chart data count:', chartData.length);

      chartInstanceRef.current.applyNewData(chartData);
      
      dataRangeRef.current = {
        symbol,
        interval,
        earliestTime: klineData.length > 0 ? klineData[0].open_time : null,
        latestTime: klineData.length > 0 ? klineData[klineData.length - 1].open_time : null,
      };
      
      message.success(`成功加载 ${chartData.length} 条K线数据`);
    } catch (error: any) {
      message.error('加载数据失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="K线图表" style={{ marginBottom: 16 }}>
      <Form
        form={form}
        layout="inline"
        onFinish={loadData}
        style={{ marginBottom: 16 }}
      >
        <Form.Item
          label="交易对"
          name="symbol"
          rules={[{ required: true, message: '请选择交易对' }]}
        >
          <Select placeholder="选择交易对" style={{ width: 120 }}>
            {config.symbols.map(symbol => (
              <Option key={symbol} value={symbol}>{symbol}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="K线间隔"
          name="interval"
          rules={[{ required: true, message: '请选择K线间隔' }]}
        >
          <Select placeholder="选择K线间隔" style={{ width: 100 }}>
            {config.intervals.map(interval => (
              <Option key={interval} value={interval}>{interval}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="结束时间"
          name="end_time"
        >
          <DatePicker
            showTime
            placeholder="结束时间"
            style={{ width: 180 }}
          />
        </Form.Item>

        <Form.Item
          label="数量"
          name="limit"
        >
          <Select style={{ width: 100 }}>
            <Option value={100}>100</Option>
            <Option value={200}>200</Option>
            <Option value={500}>500</Option>
            <Option value={1000}>1000</Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              加载数据
            </Button>
            <Button onClick={loadMoreHistoryData} disabled={!dataRangeRef.current.symbol}>
              加载更多历史
            </Button>
            <Button onClick={loadMoreFutureData} disabled={!dataRangeRef.current.symbol}>
              加载更多未来
            </Button>
          </Space>
        </Form.Item>
      </Form>

      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: '500px',
          backgroundColor: '#1a1a1a',
        }}
      />
    </Card>
  );
};

export default KlineChart;
