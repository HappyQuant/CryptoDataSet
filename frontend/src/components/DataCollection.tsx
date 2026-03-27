import React, { useState, useEffect } from 'react';
import { Form, Select, Button, Card, message, Table, Tag, Badge, Space } from 'antd';
import { PlayCircleOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';
import { useLanguage } from '../i18n/LanguageContext';

const { Option } = Select;

interface Config {
  symbols: string[];
  intervals: string[];
}

interface TaskInfo {
  task_id: string;
  task_type: string;
  symbol: string;
  interval: string;
  status: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  message_zh: string;
  message_en: string;
  collected_count: number;
  error_message?: string;
}

const DataCollection: React.FC = () => {
  const { t, locale } = useLanguage();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Config>({ symbols: [], intervals: [] });
  const [tasks, setTasks] = useState<TaskInfo[]>([]);

  const fetchConfig = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/config');
      setConfig(response.data);
    } catch (error) {
      message.error(t.collection.noDataFound);
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/tasks');
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchTasks();

    const interval = setInterval(() => {
      fetchTasks();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCollect = async (values: any) => {
    setLoading(true);

    try {
      const requestData = {
        symbol: values.symbol.toUpperCase(),
        interval: values.interval,
      };

      const response = await axios.post('http://127.0.0.1:8000/api/kline/collect', requestData);

      if (response.data.success) {
        message.success(response.data.message);
        fetchTasks();
      } else {
        message.warning(response.data.message);
      }
    } catch (error: any) {
      message.error('Collection failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag icon={<PauseCircleOutlined />} color="default">{t.collection.pending}</Tag>;
      case 'running':
        return <Tag icon={<SyncOutlined spin />} color="processing">{t.collection.running}</Tag>;
      case 'completed':
        return <Tag icon={<CheckCircleOutlined />} color="success">{t.collection.completed}</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">{t.collection.failed}</Tag>;
      case 'interrupted':
        return <Tag icon={<CloseCircleOutlined />} color="warning">{t.collection.interrupted}</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: t.collection.taskId,
      dataIndex: 'task_id',
      key: 'task_id',
      width: 200,
      ellipsis: true,
    },
    {
      title: t.management.symbol,
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: t.management.interval,
      dataIndex: 'interval',
      key: 'interval',
      width: 80,
    },
    {
      title: t.collection.status,
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: t.collection.collectedCount,
      dataIndex: 'collected_count',
      key: 'collected_count',
      width: 120,
      render: (count: number, record: TaskInfo) => (
        record.status === 'running' ? (
          <Badge count={count} showZero style={{ backgroundColor: '#6366f1' }} overflowCount={9999} />
        ) : (
          <span style={{ fontFamily: 'monospace' }}>{count.toLocaleString()}</span>
        )
      ),
    },
    {
      title: t.collection.message,
      dataIndex: locale === 'zh-CN' ? 'message_zh' : 'message_en',
      key: 'message',
      ellipsis: true,
    },
    {
      title: t.collection.createdAt,
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (timestamp: number) => moment(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t.collection.duration,
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      render: (timestamp: number) => timestamp ? moment(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  return (
    <div className="data-collection">
      <Card title={t.collection.title} className="collection-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCollect}
          className="collection-form"
        >
          <div className="form-row">
            <Form.Item
              label={t.management.symbol}
              name="symbol"
              rules={[{ required: true, message: t.collection.selectSymbol }]}
            >
              <Select
                showSearch
                placeholder={t.collection.selectSymbol}
                style={{ width: 160 }}
                filterOption={(input, option) =>
                  (option?.children as unknown as string).toLowerCase().includes(input.toLowerCase())
                }
              >
                {config.symbols.map((symbol) => (
                  <Option key={symbol} value={symbol}>
                    {symbol}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              label={t.management.interval}
              name="interval"
              rules={[{ required: true, message: t.collection.selectInterval }]}
            >
              <Select placeholder={t.collection.selectInterval} style={{ width: 120 }}>
                {config.intervals.map((interval) => (
                  <Option key={interval} value={interval}>
                    {interval}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                icon={<PlayCircleOutlined />}
                loading={loading}
              >
                {t.collection.startCollect}
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Card
        className="tasks-card"
        title={
          <Space>
            <span>{t.collection.taskList}</span>
            <SyncOutlined
              spin={tasks.some(t => t.status === 'running')}
              style={{ color: '#6366f1' }}
            />
            {tasks.some(t => t.status === 'running') && (
              <Badge status="processing" text={<span style={{ fontSize: 12, color: '#64748b' }}>{t.collection.running}</span>} />
            )}
          </Space>
        }
        extra={
          <Button
            icon={<SyncOutlined />}
            onClick={fetchTasks}
            size="small"
          >
            {t.collection.refresh}
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={tasks}
          rowKey="task_id"
          pagination={{ pageSize: 10 }}
          size="small"
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default DataCollection;
