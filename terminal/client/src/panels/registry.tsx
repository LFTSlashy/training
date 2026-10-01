import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { PanelState } from '../store/workspace';

export interface PanelProps {
  p: PanelState;
  load: (change: { fn?: string; symbol?: string }) => void;
  setParams: (params: Record<string, unknown>) => void;
}

type C = LazyExoticComponent<ComponentType<PanelProps>>;

export const PANELS: Record<string, C> = {
  GP: lazy(() => import('./Chart')),
  DES: lazy(() => import('./Description')),
  FA: lazy(() => import('./Financials')),
  DOM: lazy(() => import('./Depth')),
  TRD: lazy(() => import('./Ticket')),
  BLTR: lazy(() => import('./Blotter')),
  PORT: lazy(() => import('./Portfolio')),
  RISK: lazy(() => import('./Risk')),
  MON: lazy(() => import('./Monitor')),
  WEI: lazy(() => import('./WorldIndices')),
  FXC: lazy(() => import('./FxCross')),
  CRYP: lazy(() => import('./AssetMonitor').then((m) => ({ default: m.Crypto }))),
  CMDTY: lazy(() => import('./AssetMonitor').then((m) => ({ default: m.Commodities }))),
  GC: lazy(() => import('./Curves')),
  MOST: lazy(() => import('./Movers')),
  HMAP: lazy(() => import('./Heatmap')),
  EQS: lazy(() => import('./Screener')),
  CORR: lazy(() => import('./Correlation')),
  N: lazy(() => import('./News')),
  ECO: lazy(() => import('./Calendar')),
  ALRT: lazy(() => import('./Alerts')),
  HELP: lazy(() => import('./Help')),
};
