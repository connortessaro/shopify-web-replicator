import { NavLink, Route, Routes } from "react-router-dom";

import {
  loadDestinationStores,
  loadJob,
  loadRecentJobs,
  loadRuntime,
  submitReference
} from "./lib/api-client";
import { HandoffPage, LatestHandoffPage } from "./routes/HandoffPage";
import { IntakePage } from "./routes/IntakePage";
import { JobDetailPage } from "./routes/JobDetailPage";

function navClassName({ isActive }: { isActive: boolean }) {
  return isActive ? "nav-link nav-link--active" : "nav-link";
}

export function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-kicker">Shopify Web Replicator</div>
          <h1 className="brand-title">Operator Console</h1>
        </div>

        <nav className="nav">
          <NavLink className={navClassName} to="/">
            Reference intake
          </NavLink>
          <NavLink className={navClassName} to="/handoff">
            Theme handoff
          </NavLink>
        </nav>

        <p className="sidebar-note">
          Liquid-first scaffolding for intake, pipeline visibility, and Shopify theme review.
        </p>
      </aside>

      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <IntakePage
                submitReference={submitReference}
                loadRecentJobs={loadRecentJobs}
                loadDestinationStores={loadDestinationStores}
              />
            }
          />
          <Route path="/jobs/:jobId" element={<JobDetailPage loadJob={loadJob} />} />
          <Route
            path="/jobs/:jobId/handoff"
            element={<HandoffPage loadJob={loadJob} loadRuntime={loadRuntime} />}
          />
          <Route path="/handoff" element={<LatestHandoffPage loadRecentJobs={loadRecentJobs} />} />
        </Routes>
      </main>
    </div>
  );
}
