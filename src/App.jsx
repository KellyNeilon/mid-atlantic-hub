import { useState } from 'react';
import Homepage from './components/Homepage/Homepage';
import DistrictMap from './components/DistrictMap/DistrictMap';
import BDDirectory from './components/BDDirectory/BDDirectory';
import './App.css';

// The homepage is the shell; Project Map and BD Directory are routes
// inside it. There's no router library — just a `?tool=` query param read
// once on load, so a link like `?tool=map` (what the homepage's category
// popup opens in a new tab) lands directly on that tool instead of the
// homepage. Adding a new internal tool later: build it as its own
// self-contained component under src/components/, give its hub-tools.js
// entry an `internalView` key matching a new case here and in
// TOOL_TITLES, and add one render branch below.
const TOOL_TITLES = {
  map: 'Project Map',
  bd: 'BD Directory',
};

// Tool-to-tool toggle: while viewing one tool, jump straight to the other
// without detouring back through the homepage first (restores the
// map↔BD-directory toggle from before the homepage shell existed).
const OTHER_TOOL = {
  map: 'bd',
  bd: 'map',
};

function initialView() {
  const tool = new URLSearchParams(window.location.search).get('tool');
  return tool === 'map' || tool === 'bd' ? tool : 'home';
}

function App() {
  const [view, setView] = useState(initialView);

  function goHome() {
    setView('home');
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  function goToTool(tool) {
    setView(tool);
    window.history.replaceState(null, '', `${window.location.pathname}?tool=${tool}`);
  }

  return (
    <div className="app-shell">
      {view !== 'home' ? (
        <div className="tool-chrome">
          <button type="button" className="back-to-hub" onClick={goHome}>
            ← Marketing Hub
          </button>
          <span className="tool-chrome-title">{TOOL_TITLES[view]}</span>
          <button
            type="button"
            className="back-to-hub switch-tool"
            onClick={() => goToTool(OTHER_TOOL[view])}
          >
            Switch to {TOOL_TITLES[OTHER_TOOL[view]]} →
          </button>
        </div>
      ) : null}

      {view === 'home' ? <Homepage /> : null}

      {view === 'map' ? (
        <div className="tool-frame">
          <DistrictMap />
        </div>
      ) : null}

      {view === 'bd' ? (
        <div className="tool-frame">
          <BDDirectory />
        </div>
      ) : null}
    </div>
  );
}

export default App;
