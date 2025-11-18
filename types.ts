
export interface BrixData {
  FARMLAND: string;
  MSSR_SN: string;
  VARIETY: string;
  TAG_NO: number;
  BRIX: number;
  MEASURE_DATE: Date;
}

export interface FilterState {
  farmlands: string[];
  variety: string;
  startDate: string;
  endDate: string;
  dateFilterEnabled: boolean;
  year: string;
}

// Fix: Made `date` optional and added optional `variety` to support both time-series and categorical chart data, fixing the type error in App.tsx.
export interface ChartDataPoint {
  date?: string;
  variety?: string;
  [key: string]: string | number;
}