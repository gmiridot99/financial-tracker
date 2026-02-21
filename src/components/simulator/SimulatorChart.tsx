'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from 'recharts';
import { SimulationResult, SimulationEvent, DebtInput } from '@/lib/simulator/types';
import { TrendingUp, Home } from 'lucide-react';

interface SimulatorChartProps {
  result: SimulationResult;
  events: SimulationEvent[] | DebtInput[];
  inflationRate: number;
  startYear?: number;
}

interface ChartDataPoint {
  year: number;
  investments: number;
  savings: number;
  assets: number;
  debts: number;
  netWealth: number;
  realWealth: number;
  hasPurchase?: boolean;
  hasSale?: boolean;
  eventLabel?: string;
}

export default function SimulatorChart({ result, events, inflationRate, startYear }: SimulatorChartProps) {
  // Transform simulation result to chart data
  const chartData: ChartDataPoint[] = useMemo(() => result.yearlySnapshots.map((snapshot) => {
    const year = startYear ? startYear + snapshot.year - 1 : snapshot.year;

    const yearEvents = events.filter(e => e.year === year);
    const isSimulationEvent = yearEvents.length > 0 && 'type' in yearEvents[0];

    const purchases = isSimulationEvent
      ? yearEvents.filter((e: any) => e.type === 'purchase')
      : yearEvents;
    const sales = isSimulationEvent
      ? yearEvents.filter((e: any) => e.type === 'sale')
      : [];

    let eventLabel = '';
    if (purchases.length > 0) {
      if (isSimulationEvent) {
        eventLabel = purchases.map((p: any) => p.assetName).join(', ');
      } else {
        eventLabel = purchases.map((p: any) => p.name).join(', ');
      }
    }
    if (sales.length > 0) {
      eventLabel += (eventLabel ? ' / ' : '') + sales.map((s: any) => s.saleAssetId).join(', ');
    }

    return {
      year,
      investments: snapshot.investments,
      savings: snapshot.savings,
      assets: snapshot.totalAssets,
      debts: -snapshot.totalDebts,
      netWealth: snapshot.netWealth,
      realWealth: snapshot.realWealth,
      hasPurchase: purchases.length > 0,
      hasSale: sales.length > 0,
      eventLabel: eventLabel || undefined,
    };
  }), [result, events, startYear]);

  // Zoom state: range indices
  const totalYears = chartData.length;
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(totalYears - 1);

  // Reset range when result changes
  React.useEffect(() => {
    setRangeStart(0);
    setRangeEnd(totalYears - 1);
  }, [totalYears]);

  // Sliced data based on zoom
  const visibleData = useMemo(
    () => chartData.slice(rangeStart, rangeEnd + 1),
    [chartData, rangeStart, rangeEnd]
  );

  const handleRangeStartChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val < rangeEnd) setRangeStart(val);
  }, [rangeEnd]);

  const handleRangeEndChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (val > rangeStart) setRangeEnd(val);
  }, [rangeStart]);

  const formatCurrency = (value: number) => {
    if (value >= 1_000_000) return `\u20AC${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `\u20AC${(value / 1_000).toFixed(0)}k`;
    if (value <= -1_000_000) return `-\u20AC${(Math.abs(value) / 1_000_000).toFixed(1)}M`;
    if (value <= -1_000) return `-\u20AC${(Math.abs(value) / 1_000).toFixed(0)}k`;
    return `\u20AC${value.toFixed(0)}`;
  };

  // Custom tooltip - dark theme
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const data = payload[0].payload as ChartDataPoint;

    return (
      <div className="bg-warmBg-secondary p-4 rounded-xl shadow-lg border border-warmBg-tertiary min-w-[250px]">
        <p className="font-bold text-lg mb-3 text-warmText-primary">
          Anno {label}
        </p>

        <div className="space-y-1 mb-3 pb-3 border-b border-warmBg-tertiary">
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#3b82f6]">Investimenti:</span>
            <span className="font-semibold text-sm text-warmText-primary">
              {formatCurrency(data.investments)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#10b981]">Risparmi:</span>
            <span className="font-semibold text-sm text-warmText-primary">
              {formatCurrency(data.savings)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-[#8b5cf6]">Immobili:</span>
            <span className="font-semibold text-sm text-warmText-primary">
              {formatCurrency(data.assets)}
            </span>
          </div>
        </div>

        {data.debts < 0 && (
          <div className="mb-3 pb-3 border-b border-warmBg-tertiary">
            <div className="flex justify-between items-center">
              <span className="text-sm text-warmData-expense">Debiti:</span>
              <span className="font-semibold text-sm text-warmText-primary">
                {formatCurrency(-data.debts)}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-1 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-warmData-income">Patrimonio Netto:</span>
            <span className="font-bold text-sm text-warmText-primary">
              {formatCurrency(data.netWealth)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-warmText-tertiary">Patrimonio Reale:</span>
            <span className="font-semibold text-sm text-warmText-secondary">
              {formatCurrency(data.realWealth)}
            </span>
          </div>
        </div>

        {(data.hasPurchase || data.hasSale) && (
          <div className="pt-3 border-t border-warmBg-tertiary">
            <div className="flex items-center gap-2">
              {data.hasPurchase && (
                <div className="flex items-center gap-1 text-xs bg-[#3b82f6] bg-opacity-20 text-[#60a5fa] px-2 py-1 rounded">
                  <Home className="w-3 h-3" />
                  <span>Acquisto</span>
                </div>
              )}
              {data.hasSale && (
                <div className="flex items-center gap-1 text-xs bg-warmAccent-primary bg-opacity-20 text-warmAccent-primary px-2 py-1 rounded">
                  <TrendingUp className="w-3 h-3" />
                  <span>Vendita</span>
                </div>
              )}
            </div>
            {data.eventLabel && (
              <p className="text-xs text-warmText-tertiary mt-1">
                {data.eventLabel}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Custom legend - dark theme
  const CustomLegend = ({ payload }: any) => {
    if (!payload) return null;
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-warmText-secondary">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // Event markers
  const renderEventMarkers = () => {
    return events.map((event, index) => {
      const displayEventYear = startYear ? startYear + event.year - 1 : event.year;
      const dataPoint = visibleData.find(d => d.year === displayEventYear);
      if (!dataPoint) return null;

      const isSimulationEvent = 'type' in event;
      const isPurchase = isSimulationEvent ? event.type === 'purchase' : true;
      const color = isPurchase ? '#3b82f6' : '#f97316';

      return (
        <ReferenceDot
          key={`event-${index}`}
          x={displayEventYear}
          y={dataPoint.netWealth}
          r={6}
          fill={color}
          stroke="#0B0D11"
          strokeWidth={2}
        />
      );
    });
  };

  // Year labels for range slider
  const startLabel = chartData[rangeStart]?.year ?? '';
  const endLabel = chartData[rangeEnd]?.year ?? '';

  return (
    <div className="w-full">
      <div className="bg-warmBg-secondary rounded-xl border border-warmBg-tertiary p-6">
        <div className="mb-6">
          <h3 className="text-xl font-bold text-warmText-primary mb-2">
            Evoluzione Patrimonio Multi-Decennale
          </h3>
          <p className="text-sm text-warmText-tertiary">
            Simulazione di {result.yearlySnapshots.length} anni con inflazione al {inflationRate}%
            {rangeEnd - rangeStart + 1 < totalYears && (
              <span className="text-warmAccent-primary ml-2">
                (zoom: {startLabel} - {endLabel})
              </span>
            )}
          </p>
        </div>

        <ResponsiveContainer width="100%" height={500}>
          <ComposedChart
            data={visibleData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <defs>
              <linearGradient id="colorInvestments" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.2} />
              </linearGradient>
              <linearGradient id="colorAssets" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.2} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1A1E26"
            />

            <XAxis
              dataKey="year"
              stroke="#5A6474"
              tick={{ fill: '#5A6474', fontSize: 12 }}
              label={{ value: 'Anno', position: 'insideBottom', offset: -10, fill: '#5A6474' }}
            />

            <YAxis
              stroke="#5A6474"
              tick={{ fill: '#5A6474', fontSize: 12 }}
              tickFormatter={formatCurrency}
              label={{ value: 'Patrimonio (\u20AC)', angle: -90, position: 'insideLeft', fill: '#5A6474' }}
            />

            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />

            <Area
              type="monotone"
              dataKey="investments"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#colorInvestments)"
              name="Investimenti"
            />
            <Area
              type="monotone"
              dataKey="savings"
              stackId="1"
              stroke="#10b981"
              fill="url(#colorSavings)"
              name="Risparmi"
            />
            <Area
              type="monotone"
              dataKey="assets"
              stackId="1"
              stroke="#8b5cf6"
              fill="url(#colorAssets)"
              name="Immobili"
            />

            <Line
              type="monotone"
              dataKey="debts"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              name="Debiti"
            />

            <Line
              type="monotone"
              dataKey="netWealth"
              stroke="#059669"
              strokeWidth={3}
              dot={false}
              name="Patrimonio Netto"
            />

            <Line
              type="monotone"
              dataKey="realWealth"
              stroke="#6b7280"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Patrimonio Reale"
            />

            {renderEventMarkers()}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Zoom Range Slider */}
        <div className="mt-4 px-2">
          <div className="flex items-center gap-4">
            <span className="text-xs text-warmText-tertiary font-medium shrink-0 w-12 text-right">
              {startLabel}
            </span>
            <div className="flex-1 relative">
              {/* Track background */}
              <div className="h-2 bg-warmBg-tertiary rounded-full relative">
                {/* Active range highlight */}
                <div
                  className="absolute h-full bg-warmAccent-primary bg-opacity-40 rounded-full"
                  style={{
                    left: `${(rangeStart / Math.max(totalYears - 1, 1)) * 100}%`,
                    right: `${100 - (rangeEnd / Math.max(totalYears - 1, 1)) * 100}%`,
                  }}
                />
              </div>
              {/* Start thumb */}
              <input
                type="range"
                min={0}
                max={totalYears - 1}
                value={rangeStart}
                onChange={handleRangeStartChange}
                className="absolute top-0 left-0 w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-warmAccent-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-warmAccent-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
              />
              {/* End thumb */}
              <input
                type="range"
                min={0}
                max={totalYears - 1}
                value={rangeEnd}
                onChange={handleRangeEndChange}
                className="absolute top-0 left-0 w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-warmAccent-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-warmAccent-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
              />
            </div>
            <span className="text-xs text-warmText-tertiary font-medium shrink-0 w-12">
              {endLabel}
            </span>
          </div>
          <p className="text-xs text-warmText-disabled text-center mt-2">
            Trascina per zoomare su un intervallo specifico
          </p>
        </div>

        {/* Legend for events */}
        <div className="mt-6 pt-4 border-t border-warmBg-tertiary">
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-warmBg-secondary" />
              <span className="text-warmText-tertiary">Acquisto Asset</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 border-2 border-warmBg-secondary" />
              <span className="text-warmText-tertiary">Vendita Asset</span>
            </div>
          </div>
        </div>

        {/* Info box - dark theme */}
        <div className="mt-6 bg-warmBg-tertiary rounded-xl p-4 border border-warmBg-hover">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-warmAccent-primary mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-warmText-primary mb-1">
                Interpretazione del Grafico
              </h4>
              <ul className="text-sm text-warmText-secondary space-y-1">
                <li>&bull; <strong>Area colorata:</strong> Composizione patrimonio (Investimenti + Risparmi + Immobili)</li>
                <li>&bull; <strong>Linea verde (Patrimonio Netto):</strong> Totale di tutti i beni meno i debiti</li>
                <li>&bull; <strong>Linea tratteggiata (Patrimonio Reale):</strong> Valore corretto per l&apos;inflazione, cio&egrave; quanto varrebbe oggi</li>
                <li>&bull; <strong>Linea rossa (Debiti):</strong> Esposizione debitoria totale</li>
                <li>&bull; <strong>Punti colorati:</strong> Eventi di acquisto (blu) e vendita (arancio)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
