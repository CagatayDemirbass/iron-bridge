export function renderDashboard(): string {
  return String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Taskiron Console</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #111113;
        --panel: #191a1d;
        --panel-2: #202226;
        --line: #343741;
        --text: #f0f3f5;
        --muted: #a6adb8;
        --accent: #45c4b0;
        --accent-2: #f4b860;
        --bad: #ff6b6b;
        --good: #78d87d;
        --focus: #7fb4ff;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
      }

      button,
      input,
      textarea,
      select {
        font: inherit;
      }

      .shell {
        display: grid;
        grid-template-rows: auto 1fr;
        min-height: 100vh;
      }

      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--line);
        background: #151619;
      }

      h1 {
        margin: 0;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0;
      }

      .status {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 13px;
        white-space: nowrap;
      }

      .dot {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--accent-2);
      }

      .dot.ok {
        background: var(--good);
      }

      main {
        display: grid;
        grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
        gap: 16px;
        padding: 16px;
      }

      section {
        min-width: 0;
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
      }

      h2 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0;
      }

      form,
      .unit-tools {
        display: grid;
        gap: 12px;
        padding: 14px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }

      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #111216;
        color: var(--text);
        padding: 9px 10px;
        outline: none;
      }

      textarea {
        min-height: 104px;
        resize: vertical;
      }

      input:focus,
      textarea:focus,
      select:focus {
        border-color: var(--focus);
        box-shadow: 0 0 0 2px rgba(127, 180, 255, 0.18);
      }

      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .check {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--text);
      }

      .check input {
        width: 16px;
        height: 16px;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      button {
        min-height: 38px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--panel-2);
        color: var(--text);
        padding: 8px 12px;
        cursor: pointer;
      }

      button.primary {
        border-color: rgba(69, 196, 176, 0.55);
        background: #12332f;
      }

      button.warn {
        border-color: rgba(244, 184, 96, 0.5);
        background: #362817;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .workspace {
        display: grid;
        grid-template-rows: minmax(220px, 42vh) minmax(260px, 1fr);
        gap: 16px;
        min-width: 0;
      }

      .stream,
      .history {
        min-height: 0;
        display: grid;
        grid-template-rows: auto 1fr;
      }

      .feed {
        min-height: 0;
        overflow: auto;
        padding: 10px;
      }

      .empty {
        color: var(--muted);
        font-size: 13px;
        padding: 4px;
      }

      .message {
        display: grid;
        grid-template-columns: 58px minmax(90px, 130px) minmax(0, 1fr);
        gap: 10px;
        align-items: start;
        padding: 10px 8px;
        border-bottom: 1px solid rgba(52, 55, 65, 0.75);
      }

      .message:last-child {
        border-bottom: 0;
      }

      .pos {
        color: var(--accent);
        font-variant-numeric: tabular-nums;
        font-size: 13px;
      }

      .who {
        min-width: 0;
        color: var(--muted);
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .body {
        min-width: 0;
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .meta {
        margin-top: 4px;
        color: var(--muted);
        font-size: 11px;
      }

      .result {
        min-height: 28px;
        color: var(--muted);
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .unit-picker {
        position: relative;
        display: grid;
        gap: 8px;
        z-index: 4;
      }

      .unit-picker-bar {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        align-items: center;
        width: 100%;
        text-align: left;
      }

      .unit-picker-bar[aria-expanded="true"] {
        border-color: rgba(69, 196, 176, 0.55);
        background: #143531;
      }

      .unit-picker-title,
      .unit-picker-summary {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .unit-picker-title {
        font-size: 12px;
        font-weight: 700;
      }

      .unit-picker-summary,
      .unit-picker-action {
        color: var(--muted);
        font-size: 11px;
      }

      .unit-popover {
        position: fixed;
        left: 18px;
        bottom: 18px;
        display: grid;
        grid-template-rows: auto minmax(0, 1fr);
        gap: 8px;
        width: min(520px, calc(100vw - 36px));
        max-height: min(520px, calc(100vh - 36px));
        padding: 10px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #151619;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        overflow: hidden;
        z-index: 30;
      }

      .unit-popover[hidden] {
        display: none;
      }

      .unit-filter {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 8px;
        align-items: center;
      }

      .unit-filter input {
        height: 38px;
        min-height: 38px;
        padding: 7px 9px;
        font-size: 12px;
      }

      .unit-filter-meta {
        color: var(--muted);
        font-size: 11px;
        white-space: nowrap;
      }

      .unit-list {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-height: 0;
        overflow: auto;
        padding-right: 2px;
      }

      .unit-list[hidden] {
        display: none;
      }

      .unit-row {
        display: grid;
        grid-template-columns: 42px minmax(0, 1fr) max-content;
        gap: 8px;
        align-items: center;
        width: 100%;
        height: 54px;
        min-height: 54px;
        padding: 0 10px;
        border-color: transparent;
        background: #1b1d21;
        text-align: left;
        overflow: hidden;
      }

      .unit-row:hover {
        border-color: rgba(127, 180, 255, 0.35);
        background: #20242b;
      }

      .unit-row.active {
        border-color: rgba(69, 196, 176, 0.65);
        background: #143531;
      }

      .unit-main {
        min-width: 0;
        display: grid;
        gap: 2px;
      }

      .unit-title,
      .unit-preview {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 16px;
      }

      .unit-title {
        color: var(--text);
        font-size: 12px;
        font-variant-numeric: tabular-nums;
      }

      .unit-index,
      .unit-preview,
      .unit-count {
        color: var(--muted);
        font-size: 11px;
      }

      .unit-index {
        color: var(--accent);
        font-variant-numeric: tabular-nums;
        line-height: 1;
      }

      .unit-count {
        padding: 2px 6px;
        border: 1px solid var(--line);
        border-radius: 999px;
        background: #111216;
        white-space: nowrap;
      }

      code {
        color: var(--accent-2);
      }

      @media (max-width: 860px) {
        main {
          grid-template-columns: 1fr;
        }

        .workspace {
          grid-template-rows: minmax(220px, 40vh) minmax(260px, 1fr);
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header>
        <h1>Taskiron Console</h1>
        <div class="status"><span id="health-dot" class="dot"></span><span id="health">Checking</span></div>
      </header>

      <main>
        <section>
          <div class="section-head">
            <h2>Composer</h2>
          </div>
          <form id="message-form">
            <div class="grid-2">
              <label>
                Tenant
                <input id="tenant" name="tenant" value="t1" autocomplete="off" />
              </label>
              <label>
                Participant
                <input id="participant" name="participant" value="alice" autocomplete="off" />
              </label>
            </div>

            <div class="grid-2">
              <label>
                Kind
                <select id="participant-kind" name="participantKind">
                  <option value="human">human</option>
                  <option value="agent">agent</option>
                  <option value="system">system</option>
                </select>
              </label>
              <label>
                Idempotency key (next message)
                <input id="idempotency-key" name="idempotencyKey" autocomplete="off" />
              </label>
            </div>

            <label>
              Unit ID
              <input
                id="unit-id"
                name="unitId"
                autocomplete="off"
                placeholder="Leave empty to create a new unit"
              />
            </label>

            <label>
              Body
              <textarea id="body" name="body">ping</textarea>
            </label>

            <label class="check">
              <input id="dispatch-agent" name="dispatchAgent" type="checkbox" checked />
              Dispatch agent
            </label>

            <div class="actions">
              <button class="primary" type="submit">Send</button>
              <button type="button" id="retry-last" disabled>Retry last request</button>
              <button type="button" id="new-key">New message key</button>
              <button type="button" id="clear-unit">Start new unit</button>
            </div>

            <div id="result" class="result"></div>
            <div id="last-key" class="result">No request sent yet.</div>
          </form>

          <div class="section-head">
            <h2>Unit</h2>
          </div>
          <div class="unit-tools">
            <div class="actions">
              <button type="button" id="connect">Connect</button>
              <button type="button" id="disconnect" class="warn" disabled>Disconnect</button>
              <button type="button" id="refresh">Refresh</button>
            </div>
            <div id="unit-picker" class="unit-picker">
              <button
                type="button"
                id="unit-picker-toggle"
                class="unit-picker-bar"
                aria-expanded="false"
              >
                <span>
                  <span class="unit-picker-title">Recent units</span>
                  <span id="unit-picker-summary" class="unit-picker-summary">No units loaded</span>
                </span>
                <span id="unit-picker-action" class="unit-picker-action">Open</span>
              </button>
              <div id="unit-popover" class="unit-popover" hidden>
                <div class="unit-filter">
                  <input
                    id="unit-search"
                    type="search"
                    placeholder="Filter units"
                    autocomplete="off"
                  />
                  <span id="unit-filter-meta" class="unit-filter-meta">0 shown</span>
                </div>
                <div id="unit-list" class="unit-list"><div class="empty">No units</div></div>
              </div>
            </div>
          </div>
        </section>

        <div class="workspace">
          <section class="stream">
            <div class="section-head">
              <h2>Live Stream</h2>
              <div id="stream-state" class="status"><span class="dot"></span><span>Idle</span></div>
            </div>
            <div id="live-feed" class="feed"><div class="empty">No events</div></div>
          </section>

          <section class="history">
            <div class="section-head">
              <h2>History</h2>
              <div id="history-count" class="status">0 messages</div>
            </div>
            <div id="history-feed" class="feed"><div class="empty">No messages</div></div>
          </section>
        </div>
      </main>
    </div>

    <script>
      const $ = (id) => document.getElementById(id);
      let source = null;
      let lastSubmission = null;
      let unitListOpen = false;
      let cachedUnits = [];
      let historyMessages = [];
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

      function nextKey() {
        $("idempotency-key").value = "web-" + crypto.randomUUID();
      }

      function unitIdOrThrow() {
        const unitId = $("unit-id").value.trim();
        if (unitId && !uuidPattern.test(unitId)) {
          throw new Error("Unit ID must be a UUID. Leave it empty to create a new unit.");
        }
        return unitId;
      }

      function formValue() {
        const unitId = unitIdOrThrow();
        return {
          tenant: $("tenant").value.trim(),
          participant: $("participant").value.trim(),
          participantKind: $("participant-kind").value,
          idempotencyKey: $("idempotency-key").value.trim(),
          unitId: unitId || undefined,
          body: $("body").value,
          dispatchAgent: $("dispatch-agent").checked
        };
      }

      function applySubmissionToForm(submission) {
        $("tenant").value = submission.tenant;
        $("participant").value = submission.participant;
        $("participant-kind").value = submission.participantKind;
        $("idempotency-key").value = submission.idempotencyKey;
        $("unit-id").value = submission.unitId || "";
        $("body").value = submission.body;
        $("dispatch-agent").checked = submission.dispatchAgent;
      }

      function renderMessage(message) {
        const row = document.createElement("div");
        row.className = "message";
        row.innerHTML = [
          '<div class="pos">#' + escapeHtml(String(message.position)) + '</div>',
          '<div class="who">' + escapeHtml(message.participantId) + '<div class="meta">' + escapeHtml(message.participantKind) + '</div></div>',
          '<div class="body">' + escapeHtml(message.body) + '<div class="meta">' + escapeHtml(message.createdAt || "") + '</div></div>'
        ].join("");
        return row;
      }

      function escapeHtml(value) {
        return value.replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[char]);
      }

      function shortUnitId(unitId) {
        return unitId.slice(0, 8) + "..." + unitId.slice(-6);
      }

      function setUnitListOpen(open) {
        unitListOpen = open;
        $("unit-popover").hidden = !open;
        $("unit-picker-toggle").setAttribute("aria-expanded", String(open));
        $("unit-picker-action").textContent = open ? "Close" : "Open";
        if (open) {
          $("unit-search").focus();
        }
      }

      function updateUnitSummary(units) {
        const selected = $("unit-id").value.trim();
        const selectedUnit = units.find((unit) => unit.id === selected);
        if (!units.length) {
          $("unit-picker-summary").textContent = "No units for this tenant";
          return;
        }
        if (selectedUnit) {
          $("unit-picker-summary").textContent =
            units.length + " units - selected " + shortUnitId(selectedUnit.id);
          return;
        }
        const newest = [...units].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        $("unit-picker-summary").textContent =
          units.length + " units - latest " + shortUnitId(newest.id);
      }

      function renderUnits(units) {
        const list = $("unit-list");
        const selected = $("unit-id").value.trim();
        const query = $("unit-search").value.trim().toLowerCase();
        const chronological = [...units].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const filtered = chronological.filter((unit) => {
          const searchable = [
            unit.id,
            shortUnitId(unit.id),
            unit.lastMessageBody || "",
            String(unit.messageCount)
          ].join(" ").toLowerCase();
          return !query || searchable.includes(query);
        });

        updateUnitSummary(chronological);
        $("unit-filter-meta").textContent =
          filtered.length + " of " + chronological.length + " shown";
        list.replaceChildren();

        if (!filtered.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = chronological.length ? "No matching units" : "No units";
          list.appendChild(empty);
          return;
        }

        filtered.forEach((unit) => {
          const chronologicalIndex = chronological.findIndex((candidate) => candidate.id === unit.id);
          const row = document.createElement("button");
          row.type = "button";
          row.className = "unit-row" + (unit.id === selected ? " active" : "");
          row.dataset.unitId = unit.id;
          const preview = unit.lastMessageBody || "No messages yet";
          row.title = unit.id + "\n" + preview;
          row.innerHTML = [
            '<div class="unit-index">#' + escapeHtml(String(chronologicalIndex + 1)) + '</div>',
            '<div class="unit-main"><div class="unit-title">' + escapeHtml(shortUnitId(unit.id)) + '</div>',
            '<div class="unit-preview">' + escapeHtml(preview) + '</div></div>',
            '<div class="unit-count">' + escapeHtml(String(unit.messageCount)) + ' msg</div>'
          ].join("");
          list.appendChild(row);
        });
      }

      async function loadUnits() {
        const tenant = $("tenant").value.trim();
        if (!tenant) {
          cachedUnits = [];
          renderUnits([]);
          return cachedUnits;
        }

        const response = await fetch("/units?tenant=" + encodeURIComponent(tenant));
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        cachedUnits = payload.units;
        renderUnits(cachedUnits);
        return cachedUnits;
      }

      async function selectUnit(unitId) {
        $("unit-id").value = unitId;
        setUnitListOpen(false);
        disconnectStream();
        $("live-feed").innerHTML = '<div class="empty">No events</div>';
        await refreshHistory();
        await loadUnits();
      }

      function setFeed(feed, messages) {
        feed.replaceChildren();
        if (!messages.length) {
          const empty = document.createElement("div");
          empty.className = "empty";
          empty.textContent = "No messages";
          feed.appendChild(empty);
          return;
        }

        for (const message of messages) {
          feed.appendChild(renderMessage(message));
        }
        feed.scrollTop = feed.scrollHeight;
      }

      function setHistory(messages) {
        historyMessages = [...messages].sort((a, b) => a.position - b.position);
        setFeed($("history-feed"), historyMessages);
        $("history-count").textContent = historyMessages.length + " messages";
      }

      function appendHistory(message) {
        const selectedUnitId = $("unit-id").value.trim();
        if (message.unitId !== selectedUnitId || historyMessages.some((item) => item.id === message.id)) {
          return;
        }

        setHistory([...historyMessages, message]);
      }

      function appendLive(message) {
        const feed = $("live-feed");
        if (feed.querySelector(".empty")) {
          feed.replaceChildren();
        }
        feed.appendChild(renderMessage(message));
        feed.scrollTop = feed.scrollHeight;
        appendHistory(message);
      }

      async function refreshHistory() {
        const tenant = $("tenant").value.trim();
        let unitId;
        try {
          unitId = unitIdOrThrow();
        } catch (error) {
          $("result").textContent = error.message;
          return;
        }
        if (!tenant || !unitId) {
          setHistory([]);
          return;
        }

        const response = await fetch("/units/" + encodeURIComponent(unitId) + "/messages?tenant=" + encodeURIComponent(tenant));
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const payload = await response.json();
        setHistory(payload.messages);
      }

      async function refreshCurrentUnit() {
        const units = await loadUnits();
        if (!$("unit-id").value.trim() && units.length) {
          $("unit-id").value = units[0].id;
          $("result").innerHTML =
            "Loaded latest unit <code>" + escapeHtml(shortUnitId(units[0].id)) + "</code>";
        }

        await refreshHistory();
        await loadUnits();
      }

      function connectStream() {
        const tenant = $("tenant").value.trim();
        let unitId;
        try {
          unitId = unitIdOrThrow();
        } catch (error) {
          $("result").textContent = error.message;
          disconnectStream();
          return;
        }
        if (!tenant || !unitId) {
          $("result").innerHTML = "Set a <code>unitId</code> first.";
          return;
        }

        if (source) {
          source.close();
        }

        $("live-feed").replaceChildren();
        source = new EventSource("/units/" + encodeURIComponent(unitId) + "/events?tenant=" + encodeURIComponent(tenant));
        $("connect").disabled = true;
        $("disconnect").disabled = false;
        $("stream-state").innerHTML = '<span class="dot ok"></span><span>Connected</span>';

        source.addEventListener("message", (event) => {
          appendLive(JSON.parse(event.data));
        });
        source.onerror = () => {
          $("stream-state").innerHTML = '<span class="dot"></span><span>Reconnecting</span>';
        };
      }

      function disconnectStream() {
        if (source) {
          source.close();
          source = null;
        }
        $("connect").disabled = false;
        $("disconnect").disabled = true;
        $("stream-state").innerHTML = '<span class="dot"></span><span>Idle</span>';
      }

      async function checkHealth() {
        try {
          const response = await fetch("/health");
          const payload = await response.json();
          $("health-dot").classList.toggle("ok", Boolean(payload.ok));
          $("health").textContent = payload.ok ? "Online" : "Error";
        } catch {
          $("health-dot").classList.remove("ok");
          $("health").textContent = "Offline";
        }
      }

      async function submitPayload(payload, options = { rotateKey: true }) {
        $("result").textContent = "Sending";

        const response = await fetch("/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": payload.idempotencyKey
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
          const detail =
            result.error === "UnitNotFound"
              ? "Unit not found. It may have been reset; click Start new unit to start fresh."
              : result.issues?.[0]?.message;
          $("result").textContent = detail ? result.error + ": " + detail : result.error || "Request failed";
          return;
        }

        $("unit-id").value = result.unitId;
        lastSubmission = {
          ...payload,
          unitId: result.unitId
        };
        $("retry-last").disabled = false;
        $("last-key").innerHTML = "Last sent idempotency key <code>" + escapeHtml(result.idempotencyKey) + "</code>";
        $("result").innerHTML = result.duplicate
          ? "Duplicate retry. No new message was persisted. Original position <code>" + result.message.position + "</code>."
          : "Position <code>" + result.message.position + "</code>, duplicate <code>false</code>";
        if (options.rotateKey) {
          nextKey();
        } else {
          $("idempotency-key").value = payload.idempotencyKey;
        }
        await refreshHistory();
        await loadUnits();
        if (payload.dispatchAgent) {
          setTimeout(() => {
            Promise.all([refreshHistory(), loadUnits()]).catch((error) => {
              $("result").textContent = error.message;
            });
          }, 250);
        }
      }

      $("message-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
          await submitPayload(formValue(), { rotateKey: true });
        } catch (error) {
          $("result").textContent = error.message;
        }
      });

      $("retry-last").addEventListener("click", () => {
        if (!lastSubmission) {
          $("result").textContent = "No previous submission to retry.";
          return;
        }
        applySubmissionToForm(lastSubmission);
        submitPayload(lastSubmission, { rotateKey: false }).catch((error) => {
          $("result").textContent = error.message;
        });
      });
      $("new-key").addEventListener("click", nextKey);
      $("clear-unit").addEventListener("click", () => {
        $("unit-id").value = "";
        setHistory([]);
        $("live-feed").innerHTML = '<div class="empty">No events</div>';
        disconnectStream();
        loadUnits().catch((error) => {
          $("result").textContent = error.message;
        });
      });
      $("refresh").addEventListener("click", () => {
        refreshCurrentUnit().catch((error) => {
          $("result").textContent = error.message;
        });
      });
      $("connect").addEventListener("click", connectStream);
      $("disconnect").addEventListener("click", disconnectStream);
      $("unit-picker-toggle").addEventListener("click", () => {
        setUnitListOpen(!unitListOpen);
        if (unitListOpen) {
          loadUnits().catch((error) => {
            $("result").textContent = error.message;
          });
        }
      });
      $("unit-search").addEventListener("input", () => {
        renderUnits(cachedUnits);
      });
      $("unit-search").addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          setUnitListOpen(false);
          $("unit-picker-toggle").focus();
        }
      });
      $("unit-list").addEventListener("click", (event) => {
        const row = event.target.closest("[data-unit-id]");
        if (!row) {
          return;
        }
        selectUnit(row.dataset.unitId).catch((error) => {
          $("result").textContent = error.message;
        });
      });
      $("tenant").addEventListener("change", () => {
        disconnectStream();
        Promise.all([refreshHistory(), loadUnits()]).catch((error) => {
          $("result").textContent = error.message;
        });
      });
      document.addEventListener("click", (event) => {
        if (!unitListOpen || $("unit-picker").contains(event.target)) {
          return;
        }
        setUnitListOpen(false);
      });

      nextKey();
      void checkHealth();
      void loadUnits();
      setInterval(checkHealth, 5000);
    </script>
  </body>
</html>`;
}
