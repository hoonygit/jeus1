import React, { useMemo, useState } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, LineChart, Line 
} from 'recharts';
import type { ChartDataPoint, FilterState } from '../types';

interface BrixChartProps {
  data: ChartDataPoint[];
  timeSeriesData: ChartDataPoint[];
  selectedFarmlands: string[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
  yearList: string[];
}

const FARM_COLORS = ['#3B82F6', '#EC4899', '#4ADE80', '#F59E0B', '#8B5CF6']; // Colors for farms
const AVG_COLOR = '#F97316'; // Distinct color for overall average
const LINE_STYLES = ['solid', '5 5', '10 5', '3 3', '1 5']; // Dash patterns for line chart

const BrixChart: React.FC<BrixChartProps> = ({ data, timeSeriesData, selectedFarmlands, filters, onFilterChange, yearList }) => {
  // State to track the currently active legend item for highlighting
  const [activeLegend, setActiveLegend] = useState<string | null>(null);

  // Memoize the color mapping for farms to avoid recalculation on every render
  const farmColorMap = useMemo(() => {
    const map = new Map<string, string>();
    selectedFarmlands.forEach((farm, index) => {
        map.set(farm, FARM_COLORS[index % FARM_COLORS.length]);
    });
    return map;
  }, [selectedFarmlands]);

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ ...filters, year: e.target.value });
  };
  
  // Handles legend click: Toggles highlighting for the clicked data series.
  const handleLegendClick = (e: any) => {
    const { dataKey } = e;
    setActiveLegend(prevActive => (prevActive === dataKey ? null : dataKey));
  };
  
  // Handles chart background click: Resets any active legend highlighting.
  const handleChartClick = () => {
    setActiveLegend(null);
  };

  // Determine the current chart mode based on filters
  const isSingleDayView = filters.dateFilterEnabled && filters.startDate === filters.endDate;
  const isTimeSeries = filters.dateFilterEnabled && !isSingleDayView;
  const isVarietyComparison = !filters.dateFilterEnabled;

  const isDataEmpty = 
    (isTimeSeries && timeSeriesData.length === 0) ||
    (isSingleDayView && timeSeriesData.every(p => Object.keys(p).length <= 1)) ||
    (isVarietyComparison && data.length === 0);

  if (isDataEmpty) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary">
        표시할 데이터가 없습니다. 필터 조건을 확인해주세요.
      </div>
    );
  }

  // Dynamically generate the chart title based on the current view
  const getChartTitle = () => {
    if (isSingleDayView) {
      return `${filters.startDate} 당도 비교`;
    }
    if (isTimeSeries) {
      return '기간별 당도 추이';
    }
    return '농가별 품종별 당도 비교';
  };

  const chartTooltip = (
    <Tooltip
      contentStyle={{
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(5px)',
          border: '1px solid #E2E8F0',
          borderRadius: '0.5rem',
          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      }}
    />
  );
  
  // Using a dynamic key forces React to re-mount the chart component when the chart type changes,
  // preventing state issues within Recharts.
  let chartKey = 'variety-bar';
  if (isTimeSeries) chartKey = 'timeseries-line';
  if (isSingleDayView) chartKey = 'singleday-bar';


  return (
    <div className="h-full flex flex-col">
       <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
                <h3 className="text-lg font-semibold text-center">
                    {getChartTitle()}
                </h3>
            </div>
            {isVarietyComparison && (
            <div className="flex items-center -mt-2">
                <label htmlFor="year-filter" className="text-sm font-medium text-text-secondary mr-2 whitespace-nowrap">데이터 연도:</label>
                <select 
                    id="year-filter" 
                    value={filters.year} 
                    onChange={handleYearChange} 
                    className="p-1 border border-gray-300 rounded-md shadow-sm focus:ring-primary focus:border-primary text-sm"
                >
                {yearList.map(year => <option key={year} value={year}>{year === 'ALL' ? '전체' : `${year}년`}</option>)}
                </select>
            </div>
            )}
       </div>

      <div className="flex-grow">
        <ResponsiveContainer key={chartKey} width="100%" height="100%">
            {(() => {
                // Renders a line chart for time-series data (more than one day)
                if (isTimeSeries) {
                    return (
                        <LineChart data={timeSeriesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={handleChartClick}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey="date" tick={{ fill: '#64748B' }} />
                            <YAxis label={{ value: 'Brix', angle: -90, position: 'insideLeft', fill: '#64748B' }} tick={{ fill: '#64748B' }} domain={['dataMin - 1', 'dataMax + 1']} />
                            {chartTooltip}
                            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
                            <Line 
                                key="전체 평균" 
                                type="monotone" 
                                dataKey="전체 평균" 
                                stroke={AVG_COLOR}
                                strokeWidth={activeLegend === '전체 평균' ? 4 : 2}
                                strokeOpacity={activeLegend === null || activeLegend === '전체 평균' ? 1 : 0.3}
                                name="전체 평균" 
                                dot={false}
                                connectNulls={true}
                            />
                            {selectedFarmlands.map((farm, index) => (
                                <Line
                                    key={farm}
                                    type="monotone"
                                    dataKey={farm}
                                    stroke={farmColorMap.get(farm)}
                                    strokeWidth={activeLegend === farm ? 4 : 2}
                                    strokeOpacity={activeLegend === null || activeLegend === farm ? 1 : 0.3}
                                    name={farm}
                                    strokeDasharray={LINE_STYLES[index % LINE_STYLES.length]}
                                    dot={false}
                                    connectNulls={true}
                                />
                            ))}
                        </LineChart>
                    );
                }
                // Renders a bar chart for single-day data or variety comparison
                if (isSingleDayView || isVarietyComparison) {
                    const chartDataSource = isSingleDayView ? timeSeriesData : data;
                    const xAxisDataKey = isSingleDayView ? "date" : "variety";
                    return (
                        <BarChart data={chartDataSource} margin={{ top: 5, right: 30, left: 20, bottom: 5 }} onClick={handleChartClick}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                            <XAxis dataKey={xAxisDataKey} tick={{ fill: '#64748B' }} />
                            <YAxis label={{ value: 'Brix', angle: -90, position: 'insideLeft', fill: '#64748B' }} tick={{ fill: '#64748B' }} domain={[0, 'dataMax + 2']}/>
                            {chartTooltip}
                            <Legend onClick={handleLegendClick} wrapperStyle={{ cursor: 'pointer' }} />
                            <Bar 
                                key="전체 평균" 
                                dataKey="전체 평균" 
                                fill={AVG_COLOR} 
                                name="전체 평균" 
                                radius={[4, 4, 0, 0]}
                                fillOpacity={activeLegend === null || activeLegend === '전체 평균' ? 1 : 0.3}
                            />
                            {selectedFarmlands.map(farm => (
                                <Bar 
                                    key={farm} 
                                    dataKey={farm} 
                                    fill={farmColorMap.get(farm)} 
                                    name={farm} 
                                    radius={[4, 4, 0, 0]} 
                                    fillOpacity={activeLegend === null || activeLegend === farm ? 1 : 0.3}
                                />
                            ))}
                        </BarChart>
                    );
                }
                return null;
            })()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BrixChart;
