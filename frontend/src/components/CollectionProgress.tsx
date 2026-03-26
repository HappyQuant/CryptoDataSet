import React, { useState, useEffect, useRef } from 'react';
import { Card, Progress, Table, Button, Space, Typography, Badge, message } from 'antd';

const { Text } = Typography;

interface CollectionProgress {
  collection_key: string;
  collected_count: number;
  current_start: number;
  end_time: number;
  progress_percent: number;
  current_time_str: string;
  end_time_str: string;
}

interface CollectionProgressProps {
  onCollect?: (symbol: string, interval: string, startTime?: number, endTime?: number) => void;
}

const CollectionProgress: React.FC<CollectionProgressProps> = ({ onCollect }) => {
  const [progressData, setProgressData] = useState<CollectionProgress[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const wsUrl = 'ws://127.0.0.1:8000/ws/progress';
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket连接已建立');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          setProgressData((prev) => {
            const existingIndex = prev.findIndex(p => p.collection_key === data.collection_key);
            const newProgress = {
              collection_key: data.collection_key,
              collected_count: data.collected_count,
              current_start: data.current_start,
              end_time: data.end_time,
              progress_percent: data.progress_percent,
              current_time_str: data.current_time_str,
              end_time_str: data.end_time_str,
            };
            if (existingIndex >= 0) {
              const updated = [...prev];
              updated[existingIndex] = newProgress;
              return updated;
            }
            return [...prev, newProgress];
          });
        }
      } catch (e) {
        console.error('解析WebSocket消息失败:', e);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket连接错误:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket连接已关闭');
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleCollect = (symbol: string, interval: string) => {
    if (onCollect) {
      onCollect(symbol, interval);
    }
  };

  const columns = [
    {
      title: '交易对',
      dataIndex: 'collection_key',
      key: 'collection_key',
      render: (key: string) => {
        const parts = key.split('_');
        return <Text strong>{parts[0]}</Text>;
      }
    },
    {
      title: 'K线间隔',
      dataIndex: 'collection_key',
      key: 'interval',
      render: (key: string) => {
        const parts = key.split('_');
        return <Text>{parts.slice(1).join('_')}</Text>;
      }
    },
    {
      title: '采集数量',
      dataIndex: 'collected_count',
      key: 'collected_count',
      render: (count: number) => <Text>{count.toLocaleString()} 条</Text>
    },
    {
      title: '当前时间',
      dataIndex: 'current_time_str',
      key: 'current_time_str',
      render: (time: string) => <Text>{time}</Text>
    },
    {
      title: '进度',
      dataIndex: 'progress_percent',
      key: 'progress_percent',
      render: (percent: number) => (
        <Progress 
          size="small" 
          percent={percent} 
          status={percent >= 100 ? 'success' : 'active'} 
        />
      )
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: CollectionProgress) => (
        <Space size="small">
          <Button 
            size="small" 
            type="primary"
            onClick={() => {
              const parts = record.collection_key.split('_');
              handleCollect(parts[0], parts.slice(1).join('_'));
            }}
          >
            重新采集
          </Button>
        </Space>
      )
    }
  ];

  return (
    <Card 
      title={
        <Space>
          <Badge count={progressData.length} color="blue">
            <Text strong>数据采集进度</Text>
          </Badge>
          <Text type="secondary" style={{ fontSize: 12 }}>
            (实时WebSocket推送)
          </Text>
        </Space>
      }
      extra={
        <Button 
          size="small" 
          type="text" 
          onClick={() => setProgressData([])}
        >
          清空
        </Button>
      }
      style={{ marginBottom: 16 }}
    >
      {progressData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Text type="secondary">暂无采集任务正在进行</Text>
        </div>
      ) : (
        <Table
          dataSource={progressData}
          columns={columns}
          rowKey="collection_key"
          pagination={false}
          size="small"
          scroll={{ y: 300 }}
        />
      )}
    </Card>
  );
};

export default CollectionProgress;
