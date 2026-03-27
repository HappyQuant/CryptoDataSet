import React, { useState, useEffect } from 'react';
import { Form, Select, Button, Card, message, Table, Tag, Badge, Space } from 'antd';
import { PlayCircleOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import moment from 'moment';

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
  message: string;
  collected_count: number;
  error_message?: string;
}

const DataCollection: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<Config>({ symbols: [], intervals: [] });
  const [tasks, setTasks] = useState<TaskInfo[]>([]);

  // 获取配置
  const fetchConfig = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/config');
      setConfig(response.data);
    } catch (error) {
      message.error('获取配置失败');
    }
  };

  // 获取任务列表
  const fetchTasks = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/tasks');
      setTasks(response.data.tasks);
    } catch (error) {
      console.error('获取任务列表失败:', error);
    }
  };

  useEffect(() => {
    fetchConfig();
    fetchTasks();

    // 每3秒刷新一次任务列表
    const interval = setInterval(() => {
      fetchTasks();
    }, 3000);

    return () => {
      clearInterval(interval);
    };
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
        // 立即刷新任务列表
        fetchTasks();
      } else {
        message.warning(response.data.message);
      }
    } catch (error: any) {
      message.error('采集失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag icon={<PauseCircleOutlined />} color="default">等待中</Tag>;
      case 'running':
        return <Tag icon={<SyncOutlined spin />} color="processing">执行中</Tag>;
      case 'completed':
        return <Tag icon={<CheckCircleOutlined />} color="success">已完成</Tag>;
      case 'failed':
        return <Tag icon={<CloseCircleOutlined />} color="error">失败</Tag>;
      case 'interrupted':
        return <Tag icon={<CloseCircleOutlined />} color="warning">已中断</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 200,
      ellipsis: true,
    },
    {
      title: '交易对',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 100,
    },
    {
      title: 'K线间隔',
      dataIndex: 'interval',
      key: 'interval',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '采集数量',
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
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (timestamp: number) => moment(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '完成时间',
      dataIndex: 'completed_at',
      key: 'completed_at',
      width: 180,
      render: (timestamp: number) => timestamp ? moment(timestamp * 1000).format('YYYY-MM-DD HH:mm:ss') : '-',
    },
  ];

  return (
    <div className="data-collection">
      <Card title="K线数据采集" className="collection-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCollect}
          className="collection-form"
        >
          <div className="form-row">
            <Form.Item
              label="交易对"
              name="symbol"
              rules={[{ required: true, message: '请选择交易对' }]}
            >
              <Select
                showSearch
                placeholder="选择交易对"
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
              label="K线间隔"
              name="interval"
              rules={[{ required: true, message: '请选择K线间隔' }]}
            >
              <Select placeholder="选择K线间隔" style={{ width: 120 }}>
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
                开始采集
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Card>

      <Card
        className="tasks-card"
        title={
          <Space>
            <span>采集任务列表</span>
            <SyncOutlined
              spin={tasks.some(t => t.status === 'running')}
              style={{ color: '#6366f1' }}
            />
            {tasks.some(t => t.status === 'running') && (
              <Badge status="processing" text={<span style={{ fontSize: 12, color: '#64748b' }}>有任务正在执行</span>} />
            )}
          </Space>
        }
        extra={
          <Button
            icon={<SyncOutlined />}
            onClick={fetchTasks}
            size="small"
          >
            刷新
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
