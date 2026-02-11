/**
 * App component with routing
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { DashboardPage } from './pages/DashboardPage';
import { GameDemoPage } from './pages/GameDemoPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/wallet" element={<DashboardPage />} />
        <Route path="/dapps/game" element={<GameDemoPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
