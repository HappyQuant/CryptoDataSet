import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Card, Form, Select, message, Spin, DatePicker, Button, Tag } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, IChartApi, ISeriesApi, CandlestickData, HistogramData, LineData, Time } from 'lightweight-charts';
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

type IndicatorType = 'VOL' | 'MACD' | 'RSI' | 'KDJ' | 'BOLL' | 'CCI' | 'WR' | 'ATR' | 'ADX' | 'SAR' | 'OBV' | 'MFI' | 'Stoch';

const INDICATOR_OPTIONS: { value: IndicatorType; label: string }[] = [
  { value: 'VOL', label: 'VOL' },
  { value: 'MACD', label: 'MACD' },
  { value: 'RSI', label: 'RSI' },
  { value: 'KDJ', label: 'KDJ' },
  { value: 'BOLL', label: 'BOLL' },
  { value: 'CCI', label: 'CCI' },
  { value: 'WR', label: 'WR' },
  { value: 'ATR', label: 'ATR' },
  { value: 'ADX', label: 'ADX' },
  { value: 'SAR', label: 'SAR' },
  { value: 'OBV', label: 'OBV' },
  { value: 'MFI', label: 'MFI' },
  { value: 'Stoch', label: 'Stoch' },
];

const KlineChart: React.FC = () => {
  const mainChartContainerRef = useRef<HTMLDivElement>(null);
  const indicatorChartContainerRef = useRef<HTMLDivElement>(null);
  const mainChartRef = useRef<IChartApi | null>(null);
  const indicatorChartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ma5SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma10SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma60SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const indicatorSeries1Ref = useRef<ISeriesApi<'Histogram' | 'Line'> | null>(null);
  const indicatorSeries2Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const indicatorSeries3Ref = useRef<ISeriesApi<'Line'> | null>(null);

  const [form] = Form.useForm();
  const [configLoading, setConfigLoading] = useState(false);
  const [config, setConfig] = useState<ConfigData>({ symbols: [], intervals: [] });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoadingFuture, setIsLoadingFuture] = useState(false);
  const [selectedTime, setSelectedTime] = useState<dayjs.Dayjs | null>(null);
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorType>('VOL');
  const [visibleMAs, setVisibleMAs] = useState({ ma5: true, ma10: true, ma20: true, ma60: true });

  const dataRangeRef = useRef<{
    symbol: string;
    interval: string;
    earliestTime: number | null;
    latestTime: number | null;
  }>({ symbol: '', interval: '', earliestTime: null, latestTime: null });

  const loadMoreHistoryRef = useRef<(() => Promise<void>) | null>(null);
  const loadMoreFutureRef = useRef<(() => Promise<void>) | null>(null);
  const isLoadingHistoryRef = useRef(false);
  const isLoadingFutureRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const hasMoreFutureRef = useRef(true);

  const klineDataRef = useRef<KlineDataItem[]>([]);

  const calculateEMA = (data: number[], period: number): (number | null)[] => {
    const ema: (number | null)[] = [];
    const multiplier = 2 / (period + 1);
    for (let i = 0; i < data.length; i++) {
      if (i === 0) {
        ema.push(data[0]);
      } else if (i < period - 1) {
        const sum = data.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1);
        ema.push(sum);
      } else {
        const prevEma = ema[i - 1];
        if (prevEma !== null && prevEma !== undefined) {
          ema.push((data[i] - prevEma) * multiplier + prevEma);
        } else {
          ema.push(null);
        }
      }
    }
    return ema;
  };

  const calculateSMA = (data: number[], period: number): (number | null)[] => {
    return data.map((_, i) => {
      if (i < period - 1) return null;
      return data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
    });
  };

  const calculateRSI = (data: number[], period: number = 14): (number | null)[] => {
    const rsi: (number | null)[] = [];
    let gains: number[] = [];
    let losses: number[] = [];
    for (let i = 1; i < data.length; i++) {
      const change = data[i] - data[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    for (let i = 0; i < data.length; i++) {
      if (i < period) { rsi.push(null); }
      else {
        const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
        if (avgLoss === 0) { rsi.push(100); }
        else { const rs = avgGain / avgLoss; rsi.push(100 - (100 / (1 + rs))); }
      }
    }
    return rsi;
  };

  const calculateKDJ = (data: { high: number; low: number; close: number }[], period: number = 9): { k: (number | null)[], d: (number | null)[], j: (number | null)[] } => {
    const k: (number | null)[] = [];
    const d: (number | null)[] = [];
    const j: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { k.push(null); d.push(null); j.push(null); }
      else {
        const high = Math.max(...data.slice(i - period + 1, i + 1).map(d => d.high));
        const low = Math.min(...data.slice(i - period + 1, i + 1).map(d => d.low));
        const close = data[i].close;
        const range = high - low;
        if (range === 0) { k.push(null); d.push(null); j.push(null); continue; }
        const rsvValue = ((close - low) / range) * 100;
        const prevK = k[i - 1];
        const prevD = d[i - 1];
        if (prevK === null || prevD === null) { k.push(rsvValue); d.push(rsvValue); j.push(3 * rsvValue - 2 * rsvValue); continue; }
        const newK = (2 / 3) * prevK + (1 / 3) * rsvValue;
        const newD = (2 / 3) * prevD + (1 / 3) * newK;
        k.push(newK);
        d.push(newD);
        j.push(3 * newK - 2 * newD);
      }
    }
    return { k, d, j };
  };

  const calculateBOLL = (data: number[], period: number = 20): { upper: (number | null)[], middle: (number | null)[], lower: (number | null)[] } => {
    const middle = calculateSMA(data, period);
    const upper: (number | null)[] = [];
    const lower: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { upper.push(null); lower.push(null); }
      else {
        const slice = data.slice(i - period + 1, i + 1);
        const mean = middle[i]!;
        const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        upper.push(mean + 2 * stdDev);
        lower.push(mean - 2 * stdDev);
      }
    }
    return { upper, middle, lower };
  };

  const calculateCCI = (data: { high: number; low: number; close: number }[], period: number = 14): (number | null)[] => {
    const cci: (number | null)[] = [];
    const typicalPrices: number[] = data.map(d => (d.high + d.low + d.close) / 3);
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { cci.push(null); }
      else {
        const slice = typicalPrices.slice(i - period + 1, i + 1);
        const sma = slice.reduce((a, b) => a + b, 0) / period;
        const meanDeviation = slice.reduce((sum, val) => sum + Math.abs(val - sma), 0) / period;
        cci.push((typicalPrices[i] - sma) / (0.015 * meanDeviation));
      }
    }
    return cci;
  };

  const calculateWR = (data: { high: number; low: number; close: number }[], period: number = 14): (number | null)[] => {
    const wr: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { wr.push(null); }
      else {
        const high = Math.max(...data.slice(i - period + 1, i + 1).map(d => d.high));
        const low = Math.min(...data.slice(i - period + 1, i + 1).map(d => d.low));
        const range = high - low;
        if (range === 0) { wr.push(null); }
        else { wr.push((high - data[i].close) / range * -100); }
      }
    }
    return wr;
  };

  const calculateATR = (data: { high: number; low: number; close: number }[], period: number = 14): (number | null)[] => {
    const tr: number[] = [];
    const atr: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) { tr.push(data[i].high - data[i].low); atr.push(null); }
      else {
        const highLow = data[i].high - data[i].low;
        const highClose = Math.abs(data[i].high - data[i - 1].close);
        const lowClose = Math.abs(data[i].low - data[i - 1].close);
        tr.push(Math.max(highLow, highClose, lowClose));
        if (i < period - 1) { atr.push(null); }
        else if (i === period - 1) { atr.push(tr.slice(0, period).reduce((a, b) => a + b, 0) / period); }
        else { atr.push((atr[i - 1]! * (period - 1) + tr[i]) / period); }
      }
    }
    return atr;
  };

  const calculateSAR = (data: { high: number; low: number; close: number }[], af: number = 0.02, maxAf: number = 0.2): (number | null)[] => {
    if (data.length === 0) return [];
    const sar: (number | null)[] = [];
    let isUptrend = true;
    let ep = data[0].high;
    let currentAf = af;
    sar.push(data[0].low);
    for (let i = 1; i < data.length; i++) {
      const prevSar = sar[i - 1];
      if (prevSar === null) { sar.push(null); continue; }
      if (isUptrend) {
        const newSar = prevSar + currentAf * (ep - prevSar);
        if (data[i].low < newSar) { isUptrend = false; sar.push(data[i].high); ep = data[i].low; currentAf = af; }
        else { sar.push(Math.min(newSar, data[i - 1].low)); if (data[i].high > ep) { ep = data[i].high; currentAf = Math.min(currentAf + af, maxAf); } }
      } else {
        const newSar = prevSar - currentAf * (prevSar - ep);
        if (data[i].high > newSar) { isUptrend = true; sar.push(data[i].low); ep = data[i].high; currentAf = af; }
        else { sar.push(Math.max(newSar, data[i - 1].high)); if (data[i].low < ep) { ep = data[i].low; currentAf = Math.min(currentAf + af, maxAf); } }
      }
    }
    return sar;
  };

  const calculateOBV = (data: { close: number; volume: number }[]): (number | null)[] => {
    const obv: (number | null)[] = [null];
    for (let i = 1; i < data.length; i++) {
      if (data[i].close > data[i - 1].close) { obv.push((obv[i - 1] ?? 0) + data[i].volume); }
      else if (data[i].close < data[i - 1].close) { obv.push((obv[i - 1] ?? 0) - data[i].volume); }
      else { obv.push(obv[i - 1]); }
    }
    return obv;
  };

  const calculateMFI = (data: { high: number; low: number; close: number; volume: number }[], period: number = 14): (number | null)[] => {
    const mfi: (number | null)[] = [];
    const typicalPrices: number[] = data.map(d => (d.high + d.low + d.close) / 3);
    const moneyFlow: number[] = typicalPrices.map((tp, i) => tp * data[i].volume);
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) { mfi.push(null); }
      else {
        let positiveFlow = 0; let negativeFlow = 0;
        for (let j = i - period + 1; j <= i; j++) {
          if (typicalPrices[j] > typicalPrices[j - 1]) { positiveFlow += moneyFlow[j]; }
          else if (typicalPrices[j] < typicalPrices[j - 1]) { negativeFlow += moneyFlow[j]; }
        }
        if (negativeFlow === 0) { mfi.push(100); }
        else { const mr = positiveFlow / negativeFlow; mfi.push(100 - (100 / (1 + mr))); }
      }
    }
    return mfi;
  };

  const calculateStoch = (data: { high: number; low: number; close: number }[], kPeriod: number = 14, dPeriod: number = 3): { k: (number | null)[], d: (number | null)[] } => {
    const k: (number | null)[] = [];
    const d: (number | null)[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < kPeriod - 1) { k.push(null); d.push(null); }
      else {
        const high = Math.max(...data.slice(i - kPeriod + 1, i + 1).map(d => d.high));
        const low = Math.min(...data.slice(i - kPeriod + 1, i + 1).map(d => d.low));
        const range = high - low;
        if (range === 0) { k.push(null); d.push(null); }
        else { k.push(((data[i].close - low) / range) * 100); }
      }
    }
    for (let i = 0; i < k.length; i++) {
      if (i < kPeriod - 1 + dPeriod - 1) { d.push(null); }
      else {
        const slice = k.slice(i - dPeriod + 1, i + 1).filter(v => v !== null) as number[];
        if (slice.length === 0) { d.push(null); }
        else { d.push(slice.reduce((a, b) => a + b, 0) / slice.length); }
      }
    }
    return { k, d };
  };

  const calculateMovingAverages = (klineData: KlineDataItem[]): { ma5: LineData<Time>[], ma10: LineData<Time>[], ma20: LineData<Time>[], ma60: LineData<Time>[] } => {
    const closes = klineData.map(item => parseFloat(item.close_price));
    const ma5: LineData<Time>[] = [];
    const ma10: LineData<Time>[] = [];
    const ma20: LineData<Time>[] = [];
    const ma60: LineData<Time>[] = [];

    for (let i = 0; i < klineData.length; i++) {
      const time = (klineData[i].open_time / 1000) as Time;
      if (i >= 4) { ma5.push({ time, value: closes.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5 }); }
      if (i >= 9) { ma10.push({ time, value: closes.slice(i - 9, i + 1).reduce((a, b) => a + b, 0) / 10 }); }
      if (i >= 19) { ma20.push({ time, value: closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20 }); }
      if (i >= 59) { ma60.push({ time, value: closes.slice(i - 59, i + 1).reduce((a, b) => a + b, 0) / 60 }); }
    }
    return { ma5, ma10, ma20, ma60 };
  };

  const convertToChartData = (klineData: KlineDataItem[]): CandlestickData<Time>[] => {
    return klineData.map((item) => ({
      time: (item.open_time / 1000) as Time,
      open: parseFloat(item.open_price),
      high: parseFloat(item.high_price),
      low: parseFloat(item.low_price),
      close: parseFloat(item.close_price),
    }));
  };

  const convertToVolumeData = (klineData: KlineDataItem[]): HistogramData<Time>[] => {
    return klineData.map((item) => {
      const isUp = parseFloat(item.close_price) >= parseFloat(item.open_price);
      return { time: (item.open_time / 1000) as Time, value: parseFloat(item.base_volume), color: isUp ? '#26a69a' : '#ef5350' };
    });
  };

  const setupIndicatorChart = useCallback((indicator: IndicatorType) => {
    if (!indicatorChartContainerRef.current) return;

    if (indicatorChartRef.current) {
      try {
        indicatorChartRef.current.remove();
      } catch (e) {
        console.warn('指标图表移除失败:', e);
      }
      indicatorChartRef.current = null;
      if (indicatorChartContainerRef.current) {
        indicatorChartContainerRef.current.innerHTML = '';
      }
    }

    const chartOptions = {
      layout: { background: { color: '#1a1a1a' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2a2a2a' }, horzLines: { color: '#2a2a2a' } },
      crosshair: { mode: 0 },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#2a2a2a' },
    };

    const indChart = createChart(indicatorChartContainerRef.current, {
      ...chartOptions,
      width: indicatorChartContainerRef.current.clientWidth,
      height: 120,
    });

    indicatorChartRef.current = indChart;

    let series1: ISeriesApi<'Histogram' | 'Line'>;
    let series2: ISeriesApi<'Line'> | null = null;
    let series3: ISeriesApi<'Line'> | null = null;

    if (indicator === 'VOL') {
      series1 = indChart.addSeries(HistogramSeries, { priceScaleId: 'right', priceFormat: { type: 'volume' } });
      indChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
    } else if (['RSI', 'CCI', 'WR', 'ATR', 'ADX', 'MFI', 'Stoch', 'SAR', 'OBV'].includes(indicator)) {
      series1 = indChart.addSeries(LineSeries, { color: '#FF6B6B', lineWidth: 1, priceLineVisible: false }) as ISeriesApi<'Line'>;
      indChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
    } else if (indicator === 'MACD') {
      series1 = indChart.addSeries(HistogramSeries, { priceScaleId: 'right' });
      indChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
      series2 = indChart.addSeries(LineSeries, { color: '#2196F3', lineWidth: 1, priceLineVisible: false });
    } else if (indicator === 'KDJ') {
      series1 = indChart.addSeries(LineSeries, { color: '#FF6B6B', lineWidth: 1, priceLineVisible: false }) as ISeriesApi<'Line'>;
      indChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
      series2 = indChart.addSeries(LineSeries, { color: '#4ECDC4', lineWidth: 1, priceLineVisible: false });
    } else if (indicator === 'BOLL') {
      series1 = indChart.addSeries(LineSeries, { color: '#FF6B6B', lineWidth: 1, priceLineVisible: false }) as ISeriesApi<'Line'>;
      indChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
      series2 = indChart.addSeries(LineSeries, { color: '#4ECDC4', lineWidth: 1, priceLineVisible: false });
    } else {
      series1 = indChart.addSeries(HistogramSeries, { priceScaleId: 'right' }) as ISeriesApi<'Histogram'>;
      indChart.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0 } });
    }

    indicatorSeries1Ref.current = series1;
    indicatorSeries2Ref.current = series2;
    indicatorSeries3Ref.current = series3;

    const mainChart = mainChartRef.current;
    if (mainChart) {
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) indChart.timeScale().setVisibleLogicalRange(range);
      });
      indChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range) mainChart.timeScale().setVisibleLogicalRange(range);
      });
    }
  }, []);

  const updateIndicators = useCallback((klineData: KlineDataItem[], indicator: IndicatorType) => {
    if (!candlestickSeriesRef.current || klineData.length === 0) return;

    const chartData = convertToChartData(klineData);
    candlestickSeriesRef.current.setData(chartData);

    const { ma5, ma10, ma20, ma60 } = calculateMovingAverages(klineData);
    ma5SeriesRef.current?.setData(ma5);
    ma10SeriesRef.current?.setData(ma10);
    ma20SeriesRef.current?.setData(ma20);
    ma60SeriesRef.current?.setData(ma60);

    const closes = klineData.map(item => parseFloat(item.close_price));
    const ohlc = klineData.map(item => ({ high: parseFloat(item.high_price), low: parseFloat(item.low_price), close: parseFloat(item.close_price), volume: parseFloat(item.base_volume) }));
    const times = klineData.map(item => (item.open_time / 1000) as Time);

    if (!indicatorSeries1Ref.current || !indicatorChartRef.current) return;

    switch (indicator) {
      case 'VOL': {
        const volumeData = convertToVolumeData(klineData);
        (indicatorSeries1Ref.current as ISeriesApi<'Histogram'>).setData(volumeData);
        break;
      }
      case 'MACD': {
        const ema12 = calculateEMA(closes, 12);
        const ema26 = calculateEMA(closes, 26);
        const macdLine: (number | null)[] = ema12.map((v, i) => (v !== null && ema26[i] !== null ? v - ema26[i]! : null));
        const signalLine = calculateEMA(macdLine.filter(v => v !== null) as number[], 9);
        const histogram: HistogramData<Time>[] = [];
        let signalIdx = 0;
        for (let i = 0; i < klineData.length; i++) {
          if (macdLine[i] !== null) {
            const histValue = macdLine[i]! - (signalLine[signalIdx] ?? 0);
            histogram.push({ time: times[i], value: histValue, color: histValue >= 0 ? '#26a69a' : '#ef5350' });
            signalIdx++;
          }
        }
        (indicatorSeries1Ref.current as ISeriesApi<'Histogram'>).setData(histogram);
        if (indicatorSeries2Ref.current) {
          const macdSignalData: LineData<Time>[] = [];
          let sigIdx = 0;
          for (let i = 0; i < klineData.length; i++) {
            if (macdLine[i] !== null && signalLine[sigIdx] !== undefined) {
              macdSignalData.push({ time: times[i], value: signalLine[sigIdx] ?? 0 });
              sigIdx++;
            }
          }
          indicatorSeries2Ref.current.setData(macdSignalData);
        }
        break;
      }
      case 'RSI': {
        const rsi = calculateRSI(closes, 14);
        const rsiData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (rsi[i] !== null) rsiData.push({ time: times[i], value: rsi[i]! }); }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(rsiData);
        break;
      }
      case 'KDJ': {
        const kdj = calculateKDJ(ohlc, 9);
        const kData: LineData<Time>[] = [];
        const dData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (kdj.k[i] !== null) { kData.push({ time: times[i], value: kdj.k[i]! }); dData.push({ time: times[i], value: kdj.d[i]! }); } }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(kData);
        if (indicatorSeries2Ref.current) indicatorSeries2Ref.current.setData(dData);
        break;
      }
      case 'BOLL': {
        const boll = calculateBOLL(closes, 20);
        const upperData: LineData<Time>[] = [];
        const lowerData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (boll.upper[i] !== null) { upperData.push({ time: times[i], value: boll.upper[i]! }); lowerData.push({ time: times[i], value: boll.lower[i]! }); } }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(upperData);
        if (indicatorSeries2Ref.current) indicatorSeries2Ref.current.setData(lowerData);
        break;
      }
      case 'CCI': {
        const cci = calculateCCI(ohlc, 14);
        const cciData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (cci[i] !== null) cciData.push({ time: times[i], value: cci[i]! }); }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(cciData);
        break;
      }
      case 'WR': {
        const wr = calculateWR(ohlc, 14);
        const wrData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (wr[i] !== null) wrData.push({ time: times[i], value: wr[i]! }); }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(wrData);
        break;
      }
      case 'ATR': {
        const atr = calculateATR(ohlc, 14);
        const atrData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (atr[i] !== null) atrData.push({ time: times[i], value: atr[i]! }); }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(atrData);
        break;
      }
      case 'SAR': {
        const sar = calculateSAR(ohlc);
        const sarData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (sar[i] !== null) sarData.push({ time: times[i], value: sar[i]! }); }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(sarData);
        break;
      }
      case 'OBV': {
        const obv = calculateOBV(ohlc);
        const obvData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (obv[i] !== null) obvData.push({ time: times[i], value: obv[i]! }); }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(obvData);
        break;
      }
      case 'MFI': {
        const mfi = calculateMFI(ohlc, 14);
        const mfiData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (mfi[i] !== null) mfiData.push({ time: times[i], value: mfi[i]! }); }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(mfiData);
        break;
      }
      case 'Stoch': {
        const stoch = calculateStoch(ohlc, 14, 3);
        const kData: LineData<Time>[] = [];
        const dData: LineData<Time>[] = [];
        for (let i = 0; i < klineData.length; i++) { if (stoch.k[i] !== null) { kData.push({ time: times[i], value: stoch.k[i]! }); dData.push({ time: times[i], value: stoch.d[i]! }); } }
        (indicatorSeries1Ref.current as ISeriesApi<'Line'>).setData(kData);
        if (indicatorSeries2Ref.current) indicatorSeries2Ref.current.setData(dData);
        break;
      }
    }
    indicatorChartRef.current.timeScale().fitContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async (values: any, indicator: IndicatorType = 'VOL') => {
    if (!mainChartRef.current) { message.error('图表未初始化'); return; }
    try {
      const symbol = values.symbol.toUpperCase();
      const interval = values.interval;
      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/previous`, { params: { endTime: Date.now(), limit: 1000 } });
      const klineData: KlineDataItem[] = response.data;
      if (klineData.length === 0) { message.warning('未找到数据，请先采集数据'); return; }
      klineDataRef.current = klineData;
      const chartData = convertToChartData(klineData);
      candlestickSeriesRef.current?.setData(chartData);
      dataRangeRef.current = { symbol, interval, earliestTime: klineData[0].open_time, latestTime: klineData[klineData.length - 1].open_time };
      hasMoreHistoryRef.current = klineData.length === 1000;
      hasMoreFutureRef.current = false;
      updateIndicators(klineData, indicator);
      mainChartRef.current.timeScale().fitContent();
      console.log(`成功加载 ${klineData.length} 条K线数据`);
    } catch (error: any) {
      message.error('加载数据失败: ' + (error.response?.data?.message || error.message));
    }
  }, [updateIndicators]);

  const fetchConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/config');
      setConfig(response.data);
      if (response.data.symbols.length > 0 && response.data.intervals.length > 0) {
        form.setFieldsValue({ symbol: response.data.symbols[0], interval: response.data.intervals[0] });
        loadData({ symbol: response.data.symbols[0], interval: response.data.intervals[0] }, selectedIndicator);
      }
    } catch (error: any) {
      message.error('获取配置失败: ' + (error.response?.data?.message || error.message));
    } finally { setConfigLoading(false); }
  }, [form, loadData, selectedIndicator]);

  const loadMoreHistoryData = useCallback(async () => {
    if (!dataRangeRef.current.earliestTime || isLoadingHistoryRef.current) return;
    isLoadingHistoryRef.current = true;
    setIsLoadingHistory(true);
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${dataRangeRef.current.symbol}/${dataRangeRef.current.interval}/previous`, { params: { endTime: dataRangeRef.current.earliestTime, limit: 1000 } });
      const klineData: KlineDataItem[] = response.data;
      if (klineData.length === 0) { hasMoreHistoryRef.current = false; isLoadingHistoryRef.current = false; setIsLoadingHistory(false); return; }
      if (klineData.length < 1000) hasMoreHistoryRef.current = false;
      const allData = [...klineData, ...klineDataRef.current].sort((a, b) => a.open_time - b.open_time);
      klineDataRef.current = allData;
      updateIndicators(allData, selectedIndicator);
      dataRangeRef.current.earliestTime = klineData[0].open_time;
    } catch (error: any) { console.error('加载历史数据失败:', error); }
    finally { isLoadingHistoryRef.current = false; setIsLoadingHistory(false); }
  }, [updateIndicators, selectedIndicator]);

  const loadMoreFutureData = useCallback(async () => {
    if (!dataRangeRef.current.latestTime || isLoadingFutureRef.current) return;
    isLoadingFutureRef.current = true;
    setIsLoadingFuture(true);
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/kline/${dataRangeRef.current.symbol}/${dataRangeRef.current.interval}/next`, { params: { fromTime: dataRangeRef.current.latestTime + 1, limit: 1000 } });
      const klineData: KlineDataItem[] = response.data;
      if (klineData.length === 0) { hasMoreFutureRef.current = false; isLoadingFutureRef.current = false; setIsLoadingFuture(false); return; }
      if (klineData.length < 1000) hasMoreFutureRef.current = false;
      const allData = [...klineDataRef.current, ...klineData].sort((a, b) => a.open_time - b.open_time);
      klineDataRef.current = allData;
      updateIndicators(allData, selectedIndicator);
      dataRangeRef.current.latestTime = klineData[klineData.length - 1].open_time;
    } catch (error: any) { console.error('加载未来数据失败:', error); }
    finally { isLoadingFutureRef.current = false; setIsLoadingFuture(false); }
  }, [updateIndicators, selectedIndicator]);

  useEffect(() => {
    if (!mainChartContainerRef.current) return;

    const mainChart = createChart(mainChartContainerRef.current, {
      layout: { background: { color: '#1a1a1a' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2a2a2a' }, horzLines: { color: '#2a2a2a' } },
      crosshair: { mode: 1 },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderColor: '#2a2a2a' },
      width: mainChartContainerRef.current.clientWidth,
      height: 400,
    });

    const candlestickSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350', borderUpColor: '#26a69a', borderDownColor: '#ef5350', wickUpColor: '#26a69a', wickDownColor: '#ef5350',
    });

    const ma5Series = mainChart.addSeries(LineSeries, { color: '#FFD700', lineWidth: 1, priceLineVisible: false });
    const ma10Series = mainChart.addSeries(LineSeries, { color: '#FF6B6B', lineWidth: 1, priceLineVisible: false });
    const ma20Series = mainChart.addSeries(LineSeries, { color: '#4ECDC4', lineWidth: 1, priceLineVisible: false });
    const ma60Series = mainChart.addSeries(LineSeries, { color: '#9B59B6', lineWidth: 1, priceLineVisible: false });

    mainChartRef.current = mainChart;
    candlestickSeriesRef.current = candlestickSeries;
    ma5SeriesRef.current = ma5Series;
    ma10SeriesRef.current = ma10Series;
    ma20SeriesRef.current = ma20Series;
    ma60SeriesRef.current = ma60Series;

    setupIndicatorChart(selectedIndicator);

    mainChart.timeScale().subscribeVisibleTimeRangeChange(() => {
      const visibleRange = mainChart.timeScale().getVisibleRange();
      if (!visibleRange || !dataRangeRef.current.symbol) return;
      const currentData = klineDataRef.current;
      if (currentData.length === 0) return;
      const fromTime = visibleRange.from as number;
      const toTime = visibleRange.to as number;
      const firstBarTime = currentData[0].open_time / 1000;
      const lastBarTime = currentData[currentData.length - 1].open_time / 1000;
      const shouldLoadHistory = fromTime <= firstBarTime + 60 && !isLoadingHistoryRef.current && dataRangeRef.current.earliestTime && hasMoreHistoryRef.current;
      const shouldLoadFuture = toTime >= lastBarTime - 60 && !isLoadingFutureRef.current && dataRangeRef.current.latestTime && hasMoreFutureRef.current;
      if (shouldLoadHistory) loadMoreHistoryRef.current?.();
      if (shouldLoadFuture) loadMoreFutureRef.current?.();
    });

    const handleResize = () => {
      if (mainChartRef.current && mainChartContainerRef.current) mainChartRef.current.applyOptions({ width: mainChartContainerRef.current.clientWidth });
      if (indicatorChartRef.current && indicatorChartContainerRef.current) indicatorChartRef.current.applyOptions({ width: indicatorChartContainerRef.current.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      try {
        if (mainChartRef.current) {
          mainChartRef.current.remove();
          mainChartRef.current = null;
        }
        if (indicatorChartRef.current) {
          indicatorChartRef.current.remove();
          indicatorChartRef.current = null;
        }
      } catch (e) {
        console.warn('图表清理时出错:', e);
      }
    };
  }, [selectedIndicator, setupIndicatorChart]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);
  useEffect(() => { loadMoreHistoryRef.current = loadMoreHistoryData; loadMoreFutureRef.current = loadMoreFutureData; }, [loadMoreHistoryData, loadMoreFutureData]);

  const toggleMA = (ma: 'ma5' | 'ma10' | 'ma20' | 'ma60') => {
    setVisibleMAs(prev => {
      const newVisible = { ...prev, [ma]: !prev[ma] };
      switch (ma) {
        case 'ma5': ma5SeriesRef.current?.applyOptions({ visible: newVisible.ma5 }); break;
        case 'ma10': ma10SeriesRef.current?.applyOptions({ visible: newVisible.ma10 }); break;
        case 'ma20': ma20SeriesRef.current?.applyOptions({ visible: newVisible.ma20 }); break;
        case 'ma60': ma60SeriesRef.current?.applyOptions({ visible: newVisible.ma60 }); break;
      }
      return newVisible;
    });
  };

  const handleIndicatorChange = (indicator: IndicatorType) => {
    setSelectedIndicator(indicator);
    setupIndicatorChart(indicator);
    if (klineDataRef.current.length > 0) updateIndicators(klineDataRef.current, indicator);
  };

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if ((changedValues.symbol || changedValues.interval) && allValues.symbol && allValues.interval) loadData(allValues, selectedIndicator);
  };

  const handleJumpToTime = async () => {
    if (!selectedTime || !mainChartRef.current || !dataRangeRef.current.symbol) { message.warning('请先选择交易对和时间间隔'); return; }
    const targetTime = selectedTime.valueOf();
    const { symbol, interval } = dataRangeRef.current;
    try {
      const currentData = klineDataRef.current;
      const dataIndex = currentData.findIndex(item => Math.abs(item.open_time / 1000 - targetTime / 1000) < 60);
      if (dataIndex !== -1) { mainChartRef.current.timeScale().scrollToPosition(50, true); return; }
      const [historyResponse, futureResponse] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/previous`, { params: { endTime: targetTime, limit: 1000 } }),
        axios.get(`http://127.0.0.1:8000/api/kline/${symbol}/${interval}/next`, { params: { fromTime: targetTime, limit: 1000 } })
      ]);
      let allData = [...currentData];
      if (historyResponse.data.length > 0) allData = [...allData, ...historyResponse.data];
      if (futureResponse.data.length > 0) allData = [...allData, ...futureResponse.data];
      allData = allData.sort((a, b) => a.open_time - b.open_time);
      const uniqueDataMap = new Map<number, KlineDataItem>();
      allData.forEach(item => uniqueDataMap.set(item.open_time, item));
      const allDataUnique = Array.from(uniqueDataMap.values());
      klineDataRef.current = allDataUnique;
      updateIndicators(allDataUnique, selectedIndicator);
      hasMoreHistoryRef.current = historyResponse.data.length === 1000;
      hasMoreFutureRef.current = futureResponse.data.length === 1000;
      mainChartRef.current.timeScale().fitContent();
    } catch (error: any) { console.error('跳转失败:', error); message.error('跳转失败: ' + error.message); }
  };

  return (
    <div className="kline-chart-wrapper">
      <Card
        className="kline-chart-card"
        title="K线图表"
        extra={<Spin spinning={isLoadingHistory || isLoadingFuture} size="small"><span style={{ fontSize: 12, color: '#64748b' }}>{isLoadingHistory ? '加载历史中...' : isLoadingFuture ? '加载未来中...' : ''}</span></Spin>}
      >
        <div className="chart-controls">
          <div className="control-row">
            <Form form={form} layout="inline" onValuesChange={handleValuesChange} className="chart-form">
              <Form.Item label="交易对" name="symbol" rules={[{ required: true }]}>
                <Select style={{ width: 120 }} loading={configLoading}>{config.symbols.map(s => <Option key={s} value={s}>{s}</Option>)}</Select>
              </Form.Item>
              <Form.Item label="K线间隔" name="interval" rules={[{ required: true }]}>
                <Select style={{ width: 100 }} loading={configLoading}>{config.intervals.map(i => <Option key={i} value={i}>{i}</Option>)}</Select>
              </Form.Item>
              <Form.Item label="跳转时间">
                <DatePicker showTime value={selectedTime} onChange={setSelectedTime} placeholder="选择时间" style={{ width: 170 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" onClick={handleJumpToTime} icon={<DownloadOutlined />}>跳转</Button>
              </Form.Item>
            </Form>
          </div>

          <div className="indicator-row">
            <span className="indicator-label">指标:</span>
            <Select value={selectedIndicator} onChange={handleIndicatorChange} style={{ width: 120 }}>
              {INDICATOR_OPTIONS.map(opt => <Option key={opt.value} value={opt.value}>{opt.label}</Option>)}
            </Select>

            <div className="ma-tags">
              <Tag color="gold" onClick={() => toggleMA('ma5')} style={{ opacity: visibleMAs.ma5 ? 1 : 0.4, cursor: 'pointer' }}>● MA5</Tag>
              <Tag color="red" onClick={() => toggleMA('ma10')} style={{ opacity: visibleMAs.ma10 ? 1 : 0.4, cursor: 'pointer' }}>● MA10</Tag>
              <Tag color="cyan" onClick={() => toggleMA('ma20')} style={{ opacity: visibleMAs.ma20 ? 1 : 0.4, cursor: 'pointer' }}>● MA20</Tag>
              <Tag color="purple" onClick={() => toggleMA('ma60')} style={{ opacity: visibleMAs.ma60 ? 1 : 0.4, cursor: 'pointer' }}>● MA60</Tag>
            </div>
          </div>
        </div>

        <div ref={mainChartContainerRef} className="main-chart" />

        <div ref={indicatorChartContainerRef} className="indicator-chart" />
      </Card>
    </div>
  );
};

export default KlineChart;
