// Energy API entrypoint. Energy and meter report requests share index.js internals.
export {
  readCompanyMonthlyCache,
  writeCompanyMonthlyCache,
  getEnergyHistory,
  getCompanyEnergyDaily,
  getCompanyMeterReport,
} from './index.js';
