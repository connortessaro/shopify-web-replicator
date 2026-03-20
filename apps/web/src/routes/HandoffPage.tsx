export function HandoffPage() {
  return (
    <section className="panel stack">
      <div className="eyebrow">Theme Handoff</div>
      <h1>Local Shopify theme workspace</h1>
      <p className="lede">
        Generated sections and templates land here before any store preview or manual publish.
      </p>

      <dl className="handoff-grid">
        <div>
          <dt>Workspace path</dt>
          <dd>packages/theme-workspace</dd>
        </div>
        <div>
          <dt>Preview command</dt>
          <dd>shopify theme dev</dd>
        </div>
        <div>
          <dt>Review expectation</dt>
          <dd>Operator QA checks layout parity, content wiring, and cart to checkout handoff.</dd>
        </div>
      </dl>
    </section>
  );
}
