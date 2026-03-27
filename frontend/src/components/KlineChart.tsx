import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Form, Select, message, Spin, DatePicker, Button } from 'antd';
import { init, dispose, ActionType } from 'klinecharts';
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
  const [configLoading, setConfigLoading] = useState(false);
  const [config, setConfig] = useState<ConfigData>({ symbols: [], intervals: [] });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingFuture, setIsLoadingFuture] = useState(false);
  const [selectedTime, setSelectedTime] = useState<dayjs.Dayjs | null>(null);

  const dataRangeRef = useRef<{
    symbol: string;
    interval: string;
    earliestTime: number | null;
    latestTime: number | null;
  }>({ symbol: '', interval: '', earliestTime: null, latestTime: null });

  const loadMoreHistoryRef = useRef<(() => Promise<void>) | null>(null);
  const loadMoreFutureRef = useRef<(() => Promise<void>) | null>(null);
  const lastFromIndexRef = useRef(0);
  const isLoadingHistoryRef = useRef(false);
  const isLoadingFutureRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const hasMoreFutureRef = useRef(true);

  const loadData = useCallback(async (values: any) => {
    if (!chartInstanceRef.current) {
      message.error('图表未初始化');
      return;
    }

    try {
      const symbol = values.symbol.toUpperCase();
      const interval = values.interval;
      const endTime = Date.now();
      const limit = 1000;

      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/previous`, {
        params: {
          endTime,
          limit
        }
      });

      const klineData: KlineDataItem[] = response.data;

      if (klineData.length === 0) {
        message.warning('未找到数据，请先采集数据');
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

      hasMoreHistoryRef.current = klineData.length === limit;
      hasMoreFutureRef.current = false;

      console.log(`成功加载 ${chartData.length} 条K线数据`);
    } catch (error: any) {
      message.error('加载数据失败: ' + (error.response?.data?.message || error.message));
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/config');
      setConfig(response.data);
      if (response.data.symbols.length > 0 && response.data.intervals.length > 0) {
        form.setFieldsValue({
          symbol: response.data.symbols[0],
          interval: response.data.intervals[0],
        });
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
  }, [form, loadData]);

  const loadMoreHistoryData = useCallback(async () => {
    if (!dataRangeRef.current.earliestTime || !chartInstanceRef.current || isLoadingHistoryRef.current) {
      console.log('不满足加载历史数据条件:', {
        hasEarliestTime: !!dataRangeRef.current.earliestTime,
        hasChartInstance: !!chartInstanceRef.current,
        isLoadingHistory: isLoadingHistoryRef.current
      });
      return;
    }

    console.log('开始加载历史数据，最早时间:', dataRangeRef.current.earliestTime);
    isLoadingHistoryRef.current = true;
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
        hasMoreHistoryRef.current = false;
        isLoadingHistoryRef.current = false;
        setIsLoadingHistory(false);
        return;
      }

      if (klineData.length < limit) {
        hasMoreHistoryRef.current = false;
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
      isLoadingHistoryRef.current = false;
      setIsLoadingHistory(false);
    }
  }, []);

  const loadMoreFutureData = useCallback(async () => {
    if (!dataRangeRef.current.latestTime || !chartInstanceRef.current || isLoadingFutureRef.current) {
      console.log('不满足加载未来数据条件:', {
        hasLatestTime: !!dataRangeRef.current.latestTime,
        hasChartInstance: !!chartInstanceRef.current,
        isLoadingFuture: isLoadingFutureRef.current
      });
      return;
    }

    console.log('开始加载未来数据，最晚时间:', dataRangeRef.current.latestTime);
    isLoadingFutureRef.current = true;
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
        hasMoreFutureRef.current = false;
        isLoadingFutureRef.current = false;
        setIsLoadingFuture(false);
        return;
      }

      if (klineData.length < limit) {
        hasMoreFutureRef.current = false;
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
      isLoadingFutureRef.current = false;
      setIsLoadingFuture(false);
    }
  }, []);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;
    container.style.width = '100%';
    container.style.height = '500px';

    if (!chartInstanceRef.current) {
      console.log('初始化图表');
      chartInstanceRef.current = init(container);
      console.log('图表实例:', chartInstanceRef.current);
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
  }, [fetchConfig]);

  useEffect(() => {
    const chart = chartInstanceRef.current;
    if (!chart) {
      console.log('图表实例不存在，无法订阅事件');
      return;
    }

    console.log('开始订阅图表事件');
    let debounceTimer: NodeJS.Timeout | null = null;

    const handleVisibleRangeChange = (action?: any) => {
      console.log('事件触发，action:', action);
      if (!dataRangeRef.current.symbol) {
        console.log('symbol未设置');
        return;
      }

      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        const dataList = chart.getDataList();
        if (!dataList || dataList.length === 0) {
          console.log('数据列表为空');
          return;
        }

        const visibleRange = chart.getVisibleRange();
        if (!visibleRange) {
          console.log('visibleRange为空');
          return;
        }

        const dataCount = dataList.length;
        let fromIndex: number;
        let toIndex: number;

        if (visibleRange.from < 1 && visibleRange.to < 1) {
          fromIndex = Math.floor(visibleRange.from * dataCount);
          toIndex = Math.ceil(visibleRange.to * dataCount);
        } else {
          fromIndex = Math.floor(visibleRange.from);
          toIndex = Math.ceil(visibleRange.to);
        }

        console.log('可视区域:', {
          from: visibleRange.from,
          to: visibleRange.to,
          fromIndex,
          toIndex,
          totalData: dataCount,
          lastFromIndex: lastFromIndexRef.current,
          isLoadingHistory: isLoadingHistoryRef.current,
          hasEarliestTime: !!dataRangeRef.current.earliestTime
        });

        const shouldLoadHistory = fromIndex < 20 &&
                                  fromIndex <= 100 &&
                                  !isLoadingHistoryRef.current &&
                                  dataRangeRef.current.earliestTime &&
                                  hasMoreHistoryRef.current;

        const shouldLoadFuture = toIndex >= dataCount - 1 &&
                                 !isLoadingFutureRef.current &&
                                 dataRangeRef.current.latestTime &&
                                 hasMoreFutureRef.current;

        if (shouldLoadHistory) {
          console.log('触发加载历史数据，fromIndex:', fromIndex);
          loadMoreHistoryRef.current?.();
        }

        if (shouldLoadFuture) {
          console.log('触发加载未来数据，toIndex:', toIndex, 'dataCount:', dataCount);
          loadMoreFutureRef.current?.();
        }

        lastFromIndexRef.current = fromIndex;
      }, 300);
    };

    console.log('订阅 OnVisibleRangeChange 事件');
    chart.subscribeAction(ActionType.OnVisibleRangeChange, handleVisibleRangeChange);
    console.log('订阅 OnScroll 事件');
    chart.subscribeAction(ActionType.OnScroll, handleVisibleRangeChange);
    console.log('订阅 OnZoom 事件');
    chart.subscribeAction(ActionType.OnZoom, handleVisibleRangeChange);

    console.log('事件订阅完成');

    return () => {
      console.log('取消订阅事件');
      if (chart) {
        chart.unsubscribeAction(ActionType.OnVisibleRangeChange, handleVisibleRangeChange);
        chart.unsubscribeAction(ActionType.OnScroll, handleVisibleRangeChange);
        chart.unsubscribeAction(ActionType.OnZoom, handleVisibleRangeChange);
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, []);

  useEffect(() => {
    loadMoreHistoryRef.current = loadMoreHistoryData;
    loadMoreFutureRef.current = loadMoreFutureData;
  }, [loadMoreHistoryData, loadMoreFutureData]);

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues.symbol || changedValues.interval) {
      if (allValues.symbol && allValues.interval) {
        loadData(allValues);
      }
    }
  };

  const handleJumpToTime = async () => {
    if (!selectedTime || !chartInstanceRef.current || !dataRangeRef.current.symbol) {
      message.warning('请先选择交易对和时间间隔');
      return;
    }

    const timestamp = selectedTime.valueOf();
    const { symbol, interval } = dataRangeRef.current;
    const limit = 1000;

    console.log('跳转到时间戳:', timestamp);

    try {
      const currentData = chartInstanceRef.current.getDataList();
      const targetTime = selectedTime.valueOf();

      const dataIndex = currentData.findIndex((item: any) =>
        Math.abs(item.timestamp - targetTime) < 60000
      );

      if (dataIndex !== -1) {
        console.log('时间点有数据，直接跳转，索引:', dataIndex);
        const targetTimestamp = currentData[dataIndex].timestamp;

        dataRangeRef.current.earliestTime = null;
        dataRangeRef.current.latestTime = null;
        hasMoreHistoryRef.current = false;
        hasMoreFutureRef.current = false;

        chartInstanceRef.current?.scrollToTimestamp(targetTimestamp, 300);
        return;
      }

      console.log('时间点没有数据，需要加载数据');

      const [historyResponse, futureResponse] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/previous`, {
          params: { endTime: timestamp, limit }
        }),
        axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/next`, {
          params: { fromTime: timestamp, limit }
        })
      ]);

      const historyData: KlineDataItem[] = historyResponse.data;
      const futureData: KlineDataItem[] = futureResponse.data;

      console.log('获取到历史数据:', historyData.length, '条');
      console.log('获取到未来数据:', futureData.length, '条');

      let chartData: any[] = [];

      if (historyData.length > 0) {
        const historyChartData = historyData.map(item => ({
          timestamp: item.open_time,
          open: parseFloat(item.open_price),
          high: parseFloat(item.high_price),
          low: parseFloat(item.low_price),
          close: parseFloat(item.close_price),
          volume: parseFloat(item.base_volume),
        }));
        chartData = [...chartData, ...historyChartData];
      }

      if (futureData.length > 0) {
        const futureChartData = futureData.map(item => ({
          timestamp: item.open_time,
          open: parseFloat(item.open_price),
          high: parseFloat(item.high_price),
          low: parseFloat(item.low_price),
          close: parseFloat(item.close_price),
          volume: parseFloat(item.base_volume),
        }));
        chartData = [...chartData, ...futureChartData];
      }

      if (chartData.length === 0) {
        message.warning('该时间点附近没有K线数据');
        return;
      }

      const allData = [...currentData, ...chartData];
      const uniqueDataMap = new Map<number, any>();
      allData.forEach(item => uniqueDataMap.set(item.timestamp, item));
      const allDataUnique = Array.from(uniqueDataMap.values());
      allDataUnique.sort((a, b) => a.timestamp - b.timestamp);

      const newDataIndex = allDataUnique.findIndex((item: any) =>
        Math.abs(item.timestamp - targetTime) < 60000
      );

      dataRangeRef.current.earliestTime = null;
      dataRangeRef.current.latestTime = null;
      hasMoreHistoryRef.current = false;
      hasMoreFutureRef.current = false;

      chartInstanceRef.current?.applyNewData(allDataUnique, true);

      console.log('newDataIndex:', newDataIndex);
      if (newDataIndex !== -1) {
        console.log('找到目标数据，准备跳转');
      } else {
        console.log('未找到目标数据，直接跳转到目标时间');
      }

      setTimeout(() => {
        const targetTimestamp = newDataIndex !== -1
          ? allDataUnique[newDataIndex].timestamp
          : targetTime;

        console.log('跳转到时间戳:', targetTimestamp, '索引:', newDataIndex);
        console.log('图表数据总量:', chartInstanceRef.current?.getDataList().length);

        chartInstanceRef.current?.scrollToTimestamp(targetTimestamp, 500);

        setTimeout(() => {
          const visibleRange = chartInstanceRef.current?.getVisibleRange();
          console.log('跳转后的可见范围:', visibleRange);
        }, 600);
      }, 300);

      if (historyData.length > 0) {
        hasMoreHistoryRef.current = historyData.length === limit;
      }

      if (futureData.length > 0) {
        hasMoreFutureRef.current = futureData.length === limit;
      }

      console.log(`加载了 ${chartData.length} 条K线数据并跳转`);
    } catch (error: any) {
      console.error('跳转失败:', error);
      message.error('跳转失败: ' + error.message);
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

        <Form.Item label="跳转时间">
          <DatePicker
            showTime
            value={selectedTime}
            onChange={setSelectedTime}
            placeholder="选择时间"
            style={{ width: 180 }}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" onClick={handleJumpToTime}>
            跳转
          </Button>
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
