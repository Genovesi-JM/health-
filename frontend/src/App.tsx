import { lazy, Suspense } from 'react';
import InformationalApp from './phase1/InformationalApp';
import { isOperationalHoldEnabled } from './phase1/policy';

const OperationalApp = lazy(() => import('./LegacyApp'));

export default function App() {
  if (isOperationalHoldEnabled()) return <InformationalApp />;
  return <Suspense fallback={<p>A carregar página…</p>}><OperationalApp /></Suspense>;
}
