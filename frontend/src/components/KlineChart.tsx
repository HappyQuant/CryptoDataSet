import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Form, Select, message, Spin } from 'antd';
import { init, dispose } from 'klinecharts';
import axios from 'axios';

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
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingFuture, setIsLoadingFuture] = useState(false);

  const dataRangeRef = useRef<{
    symbol: string;
    interval: string;
    earliestTime: number | null;
    latestTime: number | null;
  }>({ symbol: '', interval: '', earliestTime: null, latestTime: null });

  // 加载更多历史数据的引用，用于在事件监听中调用
  const loadMoreHistoryRef = useRef<(() => Promise<void>) | null>(null);
  const loadMoreFutureRef = useRef<(() => Promise<void>) | null>(null);

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

  // 设置自动加载的事件监听
  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) return;

    let debounceTimer: NodeJS.Timeout | null = null;

    const handleVisibleRangeChange = () => {
      if (!dataRangeRef.current.symbol) return;

      // 防抖处理，避免频繁触发
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        const dataList = chart.getDataList();
        if (!dataList || dataList.length === 0) return;

        const visibleRange = chart.getVisibleRange();
        if (!visibleRange) return;

        console.log('可视区域 (from, to):', visibleRange.from, visibleRange.to);

        // 如果可视区域接近数据的左边界（visibleRange.from < 0.3），
        // 说明需要加载更多历史数据（向前加载）
        if (visibleRange.from < 0.3 && !isLoadingHistory && dataRangeRef.current.earliestTime) {
          console.log('触发向前加载（可视区域接近左边界）');
          loadMoreHistoryRef.current?.();
        }

        // 如果可视区域接近数据的右边界（visibleRange.to > 0.7），
        // 说明需要加载更多未来数据（向后加载）
        if (visibleRange.to > 0.7 && !isLoadingFuture && dataRangeRef.current.latestTime) {
          console.log('触发向后加载（可视区域接近右边界）');
          loadMoreFutureRef.current?.();
        }
      }, 200);
    };

    // 订阅图表事件
    chart.subscribeAction('visibleDataChange', handleVisibleRangeChange);
    chart.subscribeAction('scroll', handleVisibleRangeChange);
    chart.subscribeAction('zoom', handleVisibleRangeChange);

    return () => {
      if (chart) {
        chart.unsubscribeAction('visibleDataChange', handleVisibleRangeChange);
        chart.unsubscribeAction('scroll', handleVisibleRangeChange);
        chart.unsubscribeAction('zoom', handleVisibleRangeChange);
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [isLoadingHistory, isLoadingFuture]);

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
        // 自动加载数据
        loadData({
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

  const loadMoreHistoryData = useCallback(async () => {
    if (!dataRangeRef.current.earliestTime || !chartInstanceRef.current || isLoadingHistory) {
      console.log('不满足加载历史数据条件:', {
        hasEarliestTime: !!dataRangeRef.current.earliestTime,
        hasChartInstance: !!chartInstanceRef.current,
        isLoadingHistory
      });
      return;
    }

    console.log('开始加载历史数据，最早时间:', dataRangeRef.current.earliestTime);
    setIsLoadingHistory(true);
    const { symbol, interval } = dataRangeRef.current;
    const limit = 1000;

    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/previous`, {
        params: {
          endTime: dataRangeRef.current.earliestTime,
          limit
        }
      });

      const klineData: KlineDataItem[] = response.data;
      console.log('获取到历史数据:', klineData.length, '条');

      if (klineData.length === 0) {
        console.log('没有更多历史数据');
        setIsLoadingHistory(false);
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

      const currentData = chartInstanceRef.current?.getDataList() || [];
      const allData = [...chartData, ...currentData];
      chartInstanceRef.current?.applyNewData(allData);

      dataRangeRef.current.earliestTime = klineData[0].open_time;
      console.log(`成功加载了 ${chartData.length} 条历史数据，新的最早时间:`, dataRangeRef.current.earliestTime);
    } catch (error: any) {
      console.error('加载历史数据失败:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isLoadingHistory]);

  const loadMoreFutureData = useCallback(async () => {
    if (!dataRangeRef.current.latestTime || !chartInstanceRef.current || isLoadingFuture) {
      console.log('不满足加载未来数据条件:', {
        hasLatestTime: !!dataRangeRef.current.latestTime,
        hasChartInstance: !!chartInstanceRef.current,
        isLoadingFuture
      });
      return;
    }

    console.log('开始加载未来数据，最晚时间:', dataRangeRef.current.latestTime);
    setIsLoadingFuture(true);
    const { symbol, interval } = dataRangeRef.current;
    const limit = 1000;

    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/next`, {
        params: {
          fromTime: dataRangeRef.current.latestTime + 1,
          limit
        }
      });

      const klineData: KlineDataItem[] = response.data;
      console.log('获取到未来数据:', klineData.length, '条');

      if (klineData.length === 0) {
        console.log('没有更多未来数据');
        setIsLoadingFuture(false);
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

      const currentData = chartInstanceRef.current?.getDataList() || [];
      const allData = [...currentData, ...chartData];
      chartInstanceRef.current?.applyNewData(allData);

      dataRangeRef.current.latestTime = klineData[klineData.length - 1].open_time;
      console.log(`成功加载了 ${chartData.length} 条未来数据，新的最晚时间:`, dataRangeRef.current.latestTime);
    } catch (error: any) {
      console.error('加载未来数据失败:', error);
    } finally {
      setIsLoadingFuture(false);
    }
  }, [isLoadingFuture]);

  // 更新 ref，确保事件监听中调用的是最新的函数
  useEffect(() => {
    loadMoreHistoryRef.current = loadMoreHistoryData;
    loadMoreFutureRef.current = loadMoreFutureData;
  }, [loadMoreHistoryData, loadMoreFutureData]);

  const loadData = async (values: any) => {
    if (!chartInstanceRef.current) {
      message.error('图表未初始化');
      return;
    }

    setLoading(true);
    try {
      const symbol = values.symbol.toUpperCase();
      const interval = values.interval;
      // 从当前时间向前加载
      const endTime = Date.now();
      const limit = 1000; // 固定加载1000条

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

  // 当选择变化时自动加载数据
  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.symbol || changedValues.interval) {
      if (allValues.symbol && allValues.interval) {
        loadData(allValues);
      }
    }
  };

  return (
    <Card
      title="K线图表"
      style={{ marginBottom: 16 }}
      extra={
        <Spin spinning={isLoadingHistory || isLoadingFuture} size="small">
          <span style={{ fontSize: 12, color: '#999' }}>
            {isLoadingHistory ? '加载历史中...' : isLoadingFuture ? '加载未来中...' : ''}
          </span>
        </Spin>
      }
    >
      <Form
        form={form}
        layout="inline"
        onValuesChange={handleValuesChange}
        style={{ marginBottom: 16 }}
      >
        <Form.Item
          label="交易对"
          name="symbol"
          rules={[{ required: true, message: '请选择交易对' }]}
        >
          <Select placeholder="选择交易对" style={{ width: 120 }} loading={configLoading}>
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
          <Select placeholder="选择K线间隔" style={{ width: 100 }} loading={configLoading}>
            {config.intervals.map(interval => (
              <Option key={interval} value={interval}>{interval}</Option>
            ))}
          </Select>
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
