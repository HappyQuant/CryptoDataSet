import React, { useState, useEffect, useRef } from 'react';
import { Card, Form, Select, Button, DatePicker, message, Space, Progress, Typography } from 'antd';
import axios from 'axios';
import dayjs from 'dayjs';

const { Text } = Typography;

const { Option } = Select;

interface ConfigData {
  symbols: string[];
  intervals: string[];
}

interface CollectionStatus {
  collected_count: number;
  current_start: number;
  end_time: number;
  progress_percent: number;
  current_time_str: string;
  end_time_str: string;
}

const DataCollection: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [config, setConfig] = useState<ConfigData>({ symbols: [], intervals: [] });
  const [collectionStatus, setCollectionStatus] = useState<CollectionStatus | null>(null);
  const [collectionKey, setCollectionKey] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
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
        });
      }
    } catch (error: any) {
      message.error('获取配置失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchCollectionStatus = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/kline/collect/status');
      
      if (response.data.total_active > 0) {
        const activeCollections = response.data.active_collections;
        
        for (const key in activeCollections) {
          if (activeCollections.hasOwnProperty(key)) {
            setCollectionKey(key);
            setCollectionStatus(activeCollections[key]);
          }
        }
      } else {
        setCollectionKey(null);
        setCollectionStatus(null);
      }
    } catch (error: any) {
      console.error('获取采集状态失败:', error);
    }
  };

  useEffect(() => {
    if (collectionKey) {
      intervalRef.current = setInterval(fetchCollectionStatus, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [collectionKey]);

  const handleCollect = async (values: any) => {
    setLoading(true);
    setCollectionStatus(null);
    setCollectionKey(null);
    
    try {
      const requestData = {
        symbol: values.symbol.toUpperCase(),
        interval: values.interval,
        start_time: values.start_time ? dayjs(values.start_time).valueOf() : undefined,
        end_time: values.end_time ? dayjs(values.end_time).valueOf() : undefined,
      };

      const response = await axios.post('http://127.0.0.1:8000/api/kline/collect', requestData);
      
      if (response.data.success) {
        message.success(response.data.message);
        setCollectionStatus(null);
        setCollectionKey(null);
      } else {
        message.error(response.data.message);
      }
    } catch (error: any) {
      message.error('采集失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  };

  return (
    <Card title="K线数据采集" bordered={false} loading={configLoading}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleCollect}
      >
        <Form.Item
          label="交易对"
          name="symbol"
          rules={[{ required: true, message: '请选择交易对' }]}
        >
          <Select placeholder="选择交易对">
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
          <Select placeholder="选择K线间隔">
            {config.intervals.map(interval => (
              <Option key={interval} value={interval}>{interval}</Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="开始时间"
          name="start_time"
        >
          <DatePicker
            showTime
            style={{ width: '100%' }}
            placeholder="选择开始时间（可选）"
          />
        </Form.Item>

        <Form.Item
          label="结束时间"
          name="end_time"
        >
          <DatePicker
            showTime
            style={{ width: '100%' }}
            placeholder="选择结束时间（可选，默认为当前时间）"
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} disabled={!!collectionKey}>
              开始采集
            </Button>
            <Button onClick={() => form.resetFields()}>
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>

      {collectionKey && collectionStatus && (
        <div style={{ marginTop: 24, padding: 16, background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
          <Typography>
            <Text strong>采集任务进行中</Text>
            <Text type="secondary" style={{ marginLeft: 16 }}>
              {collectionKey}
            </Text>
          </Typography>
          
          <div style={{ marginTop: 16 }}>
            <Progress 
              percent={collectionStatus.progress_percent} 
              status="active"
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </div>
          
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <Text strong>已采集:</Text>
              <Text>{collectionStatus.collected_count} 条</Text>
            </div>
            <div>
              <Text strong>当前进度:</Text>
              <Text>{formatTime(collectionStatus.current_start)}</Text>
            </div>
            <div>
              <Text strong>目标时间:</Text>
              <Text>{formatTime(collectionStatus.end_time)}</Text>
            </div>
            <div>
              <Text strong>进度百分比:</Text>
              <Text>{collectionStatus.progress_percent}%</Text>
            </div>
          </div>
          
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">每2秒自动刷新进度</Text>
          </div>
        </div>
      )}

      <div style={{ marginTop: 24, padding: 16, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
        <h4>使用说明：</h4>
        <ul>
          <li>从下拉列表中选择交易对</li>
          <li>从下拉列表中选择K线间隔</li>
          <li>可选设置开始和结束时间，不设置则采集到最新数据</li>
          <li>系统会自动从Binance获取数据并入库</li>
          <li>重复采集不会导致数据重复</li>
          <li>采集任务进行中会显示实时进度，再次点击会提示任务已在进行</li>
        </ul>
      </div>
    </Card>
  );
};

export default DataCollection;
