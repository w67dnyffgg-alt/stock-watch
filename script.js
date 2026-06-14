let trades = JSON.parse(localStorage.getItem("trades")) || [];
let watches = JSON.parse(localStorage.getItem("watches")) || [];
let simulations = JSON.parse(localStorage.getItem("simulations")) || [];

let editingType = null;
let editingId = null;
let editingSubId = null;

window.onload = function () {
  migrateOldData();
  setTodayDates();
  renderAll();
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function setTodayDates() {
  document.querySelectorAll('input[type="date"]').forEach((input) => {
    if (!input.value) input.value = today();
  });
}

function migrateOldData() {
  trades = trades.map((trade) => {
    if (!trade.buyDate) trade.buyDate = trade.date || today();
    if (!("sellDate" in trade)) trade.sellDate = trade.date || "";
    if (!("sellPrice" in trade)) trade.sellPrice = trade.sellPrice || null;
    if (!("profit" in trade)) trade.profit = null;
    if (!trade.logs) trade.logs = [];
    return trade;
  });

  simulations = simulations.map((sim) => {
    if (!sim.logs) sim.logs = [];
    return sim;
  });

  saveAll();
}

function showTab(event, tabId) {
  document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  event.target.classList.add("active");
}

function yen(num) {
  return `${Number(num || 0).toLocaleString()}円`;
}

function profitClass(num) {
  if (num === null || num === undefined) return "pending";
  return num >= 0 ? "plus" : "minus";
}

function profitText(num) {
  if (num === null || num === undefined) return "未確定";
  return `${num >= 0 ? "+" : ""}${yen(num)}`;
}

function statusBadge(item, virtual = false) {
  if (item.sellPrice === null || item.sellPrice === undefined) return `<span class="status-badge status-hold">🩷 ${virtual ? "検証中" : "保有中"}</span>`;
  if ((item.profit || 0) >= 0) return `<span class="status-badge status-win">💰 ${virtual ? "仮想利確" : "利確済"}</span>`;
  return `<span class="status-badge status-loss">💧 ${virtual ? "仮想損切り" : "損切り済"}</span>`;
}

function saveAll() {
  localStorage.setItem("trades", JSON.stringify(trades));
  localStorage.setItem("watches", JSON.stringify(watches));
  localStorage.setItem("simulations", JSON.stringify(simulations));
}

function renderAll() {
  displayTrades();
  displayWatches();
  displaySimulations();
  displayStockSummary();
  displayStats();
  updateBackupReminder();
}

function toggleLogs(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle("open");
}

/* モーダル */
function openEditModal(title, fieldsHtml, type, id, subId = null) {
  editingType = type;
  editingId = id;
  editingSubId = subId;
  document.getElementById("editModalTitle").textContent = title;
  document.getElementById("editFields").innerHTML = fieldsHtml;
  document.getElementById("editModal").classList.remove("hidden");
}

function closeEditModal() {
  document.getElementById("editModal").classList.add("hidden");
  editingType = null;
  editingId = null;
  editingSubId = null;
}

function saveEdit() {
  let ok = true;
  if (editingType === "tradeBuy") ok = saveTradeBuyEdit();
  if (editingType === "tradeSell") ok = saveTradeSellEdit();
  if (editingType === "tradeLog") ok = saveTradeLogEdit();
  if (editingType === "watch") ok = saveWatchEdit();
  if (editingType === "simBuy") ok = saveSimulationBuyEdit();
  if (editingType === "simSell") ok = saveSimulationSellEdit();
  if (editingType === "priceLog") ok = savePriceLogEdit();
  if (!ok) return;
  saveAll();
  renderAll();
  closeEditModal();
}

function deleteEditingItem() {
  if (!confirm("このデータを削除する？")) return;

  if (editingType === "tradeBuy" || editingType === "tradeSell") {
    trades = trades.filter((trade) => trade.id !== editingId);
  }
  if (editingType === "tradeLog") {
    const trade = trades.find((trade) => trade.id === editingId);
    if (trade) trade.logs = trade.logs.filter((log) => log.id !== editingSubId);
  }
  if (editingType === "watch") watches = watches.filter((watch) => watch.id !== editingId);
  if (editingType === "simBuy" || editingType === "simSell") {
    simulations = simulations.filter((sim) => sim.id !== editingId);
  }
  if (editingType === "priceLog") {
    const sim = simulations.find((sim) => sim.id === editingId);
    if (sim) sim.logs = sim.logs.filter((log) => log.id !== editingSubId);
  }

  saveAll();
  renderAll();
  closeEditModal();
}

/* 実取引 */
function addTrade() {
  const stockName = document.getElementById("stockName").value.trim();
  const buyDate = document.getElementById("tradeBuyDate").value || today();
  const buyPrice = Number(document.getElementById("buyPrice").value);
  const quantity = Number(document.getElementById("quantity").value);
  const feeling = document.getElementById("tradeFeeling").value;
  const memo = document.getElementById("memo").value.trim();

  if (!stockName || !buyPrice || !quantity) {
    alert("銘柄名・買値・株数を入力してね🌸");
    return;
  }

  trades.unshift({ id: Date.now(), stockName, buyDate, buyPrice, quantity, feeling, memo, sellDate: "", sellPrice: null, profit: null, logs: [] });
  saveAll();
  clearTradeForm();
  renderAll();
}

function displayTrades() {
  const tradeList = document.getElementById("tradeList");
  const totalProfit = document.getElementById("totalProfit");
  const tradeCount = document.getElementById("tradeCount");
  tradeList.innerHTML = "";
  let total = 0;
  let closedCount = 0;

  if (trades.length === 0) tradeList.innerHTML = `<div class="item empty">まだ実取引は記録されていないよ🌸</div>`;

  trades.forEach((trade) => {
    if (trade.profit !== null && trade.profit !== undefined) { total += trade.profit; closedCount++; }
    const logsId = `tradeLogs-${trade.id}`;
    const logsHtml = (trade.logs || []).map((log) => {
      const diff = (log.price - trade.buyPrice) * trade.quantity;
      return `<div class="log-box"><strong>${log.date}</strong>：${yen(log.price)}<div class="${profitClass(diff)}">買値との差：${profitText(diff)}</div><div>${log.memo || "メモなし"}</div><button class="small-btn" onclick="openTradeLogModal(${trade.id}, ${log.id})">ログ編集</button></div>`;
    }).join("");

    tradeList.innerHTML += `
      <details class="item summary-item">
        <summary class="summary-toggle">
          <span class="item-header">
            <span><span class="item-name">${trade.stockName}</span><span class="date-text">買った日：${trade.buyDate}</span></span>
            <span class="summary-profit"><span>${statusBadge(trade)}</span><span class="${profitClass(trade.profit)}">${profitText(trade.profit)}</span><span class="summary-chevron" aria-hidden="true">⌄</span></span>
          </span>
        </summary>
        <div class="summary-details">
        <div class="info-grid">
          <div class="info-card"><div class="info-title">📦 買い情報</div><div>買値：${yen(trade.buyPrice)}</div><div>株数：${trade.quantity}株</div><div class="badge">${trade.feeling || "感情メモなし"}</div><div class="memo">${trade.memo || "メモなし"}</div><button class="small-btn" onclick="openTradeBuyModal(${trade.id})">買い情報を編集する</button></div>
          <div class="info-card"><div class="info-title">💰 売り情報</div>${trade.sellPrice !== null && trade.sellPrice !== undefined ? `<div>売った日：${trade.sellDate}</div><div>売値：${yen(trade.sellPrice)}</div><div class="${profitClass(trade.profit)}">実損益：${profitText(trade.profit)}</div><button class="small-btn" onclick="openTradeSellModal(${trade.id})">売り情報を編集する</button>` : `<div class="memo">まだ売値は記録されていないよ🌸</div><button class="small-btn" onclick="openTradeSellModal(${trade.id})">売り情報を記録する</button>`}</div>
        </div>
        <div class="button-row"><button class="small-btn" onclick="openTradeLogModal(${trade.id})">途中ログを追加する</button><button class="small-btn" onclick="toggleLogs('${logsId}')">途中ログを見る（${(trade.logs || []).length}件）</button></div>
        <div id="${logsId}" class="collapsible-content">${logsHtml || `<div class="memo">まだ途中経過は記録されていないよ🌸</div>`}</div>
        </div>
      </details>`;
  });

  totalProfit.textContent = yen(total);
  totalProfit.className = profitClass(total);
  tradeCount.textContent = `${trades.length}件 / 売却済み${closedCount}件`;
}

function openTradeBuyModal(id) {
  const trade = trades.find((t) => t.id === id); if (!trade) return;
  openEditModal("買い情報を編集", `
    <label>銘柄名</label><input id="editStockName" type="text" value="${trade.stockName}">
    <label>買った日</label><input id="editTradeBuyDate" type="date" value="${trade.buyDate || today()}">
    <label>買値</label><input id="editBuyPrice" type="number" value="${trade.buyPrice}">
    <label>株数</label><input id="editQuantity" type="number" value="${trade.quantity}">
    <label>メモ</label><textarea id="editMemo">${trade.memo || ""}</textarea>
  `, "tradeBuy", id);
}

function saveTradeBuyEdit() {
  const trade = trades.find((t) => t.id === editingId); if (!trade) return false;
  const stockName = document.getElementById("editStockName").value.trim();
  const buyPrice = Number(document.getElementById("editBuyPrice").value);
  const quantity = Number(document.getElementById("editQuantity").value);
  if (!stockName || !buyPrice || !quantity) { alert("銘柄名・買値・株数を入力してね🌸"); return false; }
  trade.stockName = stockName;
  trade.buyDate = document.getElementById("editTradeBuyDate").value || today();
  trade.buyPrice = buyPrice;
  trade.quantity = quantity;
  trade.memo = document.getElementById("editMemo").value.trim();
  if (trade.sellPrice !== null && trade.sellPrice !== undefined) trade.profit = (trade.sellPrice - trade.buyPrice) * trade.quantity;
  return true;
}

function openTradeSellModal(id) {
  const trade = trades.find((t) => t.id === id); if (!trade) return;
  openEditModal(trade.sellPrice ? "売り情報を編集" : "売り情報を記録", `
    <label>売った日</label><input id="editTradeSellDate" type="date" value="${trade.sellDate || today()}">
    <label>売値</label><input id="editSellPrice" type="number" value="${trade.sellPrice || ""}">
  `, "tradeSell", id);
}

function saveTradeSellEdit() {
  const trade = trades.find((t) => t.id === editingId); if (!trade) return false;
  const sellPriceInput = document.getElementById("editSellPrice").value;
  if (sellPriceInput === "") { trade.sellPrice = null; trade.sellDate = ""; trade.profit = null; return true; }
  trade.sellPrice = Number(sellPriceInput);
  trade.sellDate = document.getElementById("editTradeSellDate").value || today();
  trade.profit = (trade.sellPrice - trade.buyPrice) * trade.quantity;
  return true;
}

function openTradeLogModal(tradeId, logId = null) {
  const trade = trades.find((t) => t.id === tradeId); if (!trade) return;
  const log = logId ? trade.logs.find((l) => l.id === logId) : { date: today(), price: "", memo: "" };
  openEditModal(logId ? "途中ログを編集" : "途中ログを追加", `
    <label>記録日</label><input id="editTradeLogDate" type="date" value="${log.date}">
    <label>株価</label><input id="editTradeLogPrice" type="number" value="${log.price || ""}">
    <label>メモ</label><textarea id="editTradeLogMemo">${log.memo || ""}</textarea>
  `, "tradeLog", tradeId, logId);
}

function saveTradeLogEdit() {
  const trade = trades.find((t) => t.id === editingId); if (!trade) return false;
  const price = Number(document.getElementById("editTradeLogPrice").value);
  if (!price) { alert("株価を入力してね🌸"); return false; }
  if (editingSubId) {
    const log = trade.logs.find((l) => l.id === editingSubId); if (!log) return false;
    log.date = document.getElementById("editTradeLogDate").value || today(); log.price = price; log.memo = document.getElementById("editTradeLogMemo").value.trim();
  } else {
    trade.logs.push({ id: Date.now(), date: document.getElementById("editTradeLogDate").value || today(), price, memo: document.getElementById("editTradeLogMemo").value.trim() });
  }
  return true;
}

function clearTradeForm() {
  document.getElementById("stockName").value = "";
  document.getElementById("tradeBuyDate").value = today();
  document.getElementById("buyPrice").value = "";
  document.getElementById("quantity").value = "";
  document.getElementById("memo").value = "";
}

/* WATCH */
function addWatch() {
  const name = document.getElementById("watchName").value.trim();
  const date = document.getElementById("watchDate").value || today();
  const price = Number(document.getElementById("watchPrice").value);
  const targetBuyPrice = Number(document.getElementById("targetBuyPrice").value);
  const takeProfitPrice = Number(document.getElementById("takeProfitPrice").value);
  const stopLossPrice = Number(document.getElementById("stopLossPrice").value);
  const status = document.getElementById("watchStatus").value;
  const memo = document.getElementById("watchMemo").value.trim();
  if (!name || !price) { alert("銘柄名と見ている株価を入力してね🌸"); return; }
  watches.unshift({ id: Date.now(), name, date, price, targetBuyPrice, takeProfitPrice, stopLossPrice, status, memo });
  saveAll(); clearWatchForm(); renderAll();
}

function displayWatches() {
  const watchList = document.getElementById("watchList"); watchList.innerHTML = "";
  if (watches.length === 0) { watchList.innerHTML = `<div class="item empty">まだWATCHリストは空だよ🌸</div>`; return; }
  watches.forEach((watch) => {
    watchList.innerHTML += `<details class="item summary-item"><summary class="summary-toggle"><span class="item-header"><span><span class="item-name">${watch.name}</span><span class="date-text">${watch.date}</span></span><span class="summary-profit"><span class="pending">${yen(watch.price)}</span><span class="summary-chevron" aria-hidden="true">⌄</span></span></span></summary><div class="summary-details"><div class="badge">${watch.status}</div><div class="memo">買いたい価格：${watch.targetBuyPrice ? yen(watch.targetBuyPrice) : "未設定"} / 利確目安：${watch.takeProfitPrice ? yen(watch.takeProfitPrice) : "未設定"} / 損切り目安：${watch.stopLossPrice ? yen(watch.stopLossPrice) : "未設定"}</div><div class="memo">${watch.memo || "メモなし"}</div><button class="small-btn" onclick="editWatch(${watch.id})">編集する</button></div></details>`;
  });
}

function editWatch(id) {
  const watch = watches.find((w) => w.id === id); if (!watch) return;
  openEditModal("WATCHを編集", `
    <label>銘柄名</label><input id="editWatchName" type="text" value="${watch.name}">
    <label>記録日</label><input id="editWatchDate" type="date" value="${watch.date}">
    <label>見ている株価</label><input id="editWatchPrice" type="number" value="${watch.price}">
    <label>買いたい価格</label><input id="editTargetBuyPrice" type="number" value="${watch.targetBuyPrice || ""}">
    <label>利確目安</label><input id="editTakeProfitPrice" type="number" value="${watch.takeProfitPrice || ""}">
    <label>損切り目安</label><input id="editStopLossPrice" type="number" value="${watch.stopLossPrice || ""}">
    <label>状態</label><select id="editWatchStatus"><option ${watch.status === "👀 様子見" ? "selected" : ""}>👀 様子見</option><option ${watch.status === "📉 下がったら買いたい" ? "selected" : ""}>📉 下がったら買いたい</option><option ${watch.status === "📈 上昇トレンド確認中" ? "selected" : ""}>📈 上昇トレンド確認中</option><option ${watch.status === "⚠️ 急落後なので慎重" ? "selected" : ""}>⚠️ 急落後なので慎重</option><option ${watch.status === "⭐ お気に入り" ? "selected" : ""}>⭐ お気に入り</option></select>
    <label>メモ</label><textarea id="editWatchMemo">${watch.memo || ""}</textarea>
  `, "watch", id);
}

function saveWatchEdit() {
  const watch = watches.find((w) => w.id === editingId); if (!watch) return false;
  const name = document.getElementById("editWatchName").value.trim();
  const price = Number(document.getElementById("editWatchPrice").value);
  if (!name || !price) { alert("銘柄名と株価を入力してね🌸"); return false; }
  watch.name = name; watch.date = document.getElementById("editWatchDate").value || today(); watch.price = price;
  watch.targetBuyPrice = Number(document.getElementById("editTargetBuyPrice").value); watch.takeProfitPrice = Number(document.getElementById("editTakeProfitPrice").value); watch.stopLossPrice = Number(document.getElementById("editStopLossPrice").value);
  watch.status = document.getElementById("editWatchStatus").value; watch.memo = document.getElementById("editWatchMemo").value.trim();
  return true;
}

function clearWatchForm() {
  document.getElementById("watchName").value = ""; document.getElementById("watchDate").value = today(); document.getElementById("watchPrice").value = ""; document.getElementById("targetBuyPrice").value = ""; document.getElementById("takeProfitPrice").value = ""; document.getElementById("stopLossPrice").value = ""; document.getElementById("watchMemo").value = "";
}

/* シミュレーション */
function addSimulation() {
  const name = document.getElementById("simName").value.trim();
  const buyDate = document.getElementById("simBuyDate").value || today();
  const buyPrice = Number(document.getElementById("simBuyPrice").value);
  const quantity = Number(document.getElementById("simQuantity").value);
  const feeling = document.getElementById("simFeeling").value;
  const memo = document.getElementById("simMemo").value.trim();
  if (!name || !buyPrice || !quantity) { alert("銘柄名・仮想買値・株数を入力してね🌸"); return; }
  simulations.unshift({ id: Date.now(), name, buyDate, buyPrice, quantity, feeling, memo, sellDate: "", sellPrice: null, profit: null, logs: [] });
  saveAll(); clearSimulationForm(); renderAll();
}

function displaySimulations() {
  const simList = document.getElementById("simList"); const simTotalProfit = document.getElementById("simTotalProfit"); const simCount = document.getElementById("simCount");
  simList.innerHTML = ""; let total = 0; let fixedCount = 0;
  if (simulations.length === 0) simList.innerHTML = `<div class="item empty">まだシミュレーションはないよ🌸</div>`;
  simulations.forEach((sim) => {
    if (sim.profit !== null && sim.profit !== undefined) { total += sim.profit; fixedCount++; }
    const logsId = `simLogs-${sim.id}`;
    const logsHtml = sim.logs.map((log) => { const diff = (log.price - sim.buyPrice) * sim.quantity; return `<div class="log-box"><strong>${log.date}</strong>：${yen(log.price)}<div class="${profitClass(diff)}">買値との差：${profitText(diff)}</div><div>${log.memo || "メモなし"}</div><button class="small-btn" onclick="openSimLogModal(${sim.id}, ${log.id})">ログ編集</button></div>`; }).join("");
    simList.innerHTML += `<details class="item summary-item"><summary class="summary-toggle"><span class="item-header"><span><span class="item-name">${sim.name}</span><span class="date-text">買ったと仮定した日：${sim.buyDate}</span></span><span class="summary-profit"><span>${statusBadge(sim, true)}</span><span class="${profitClass(sim.profit)}">${profitText(sim.profit)}</span><span class="summary-chevron" aria-hidden="true">⌄</span></span></span></summary><div class="summary-details"><div class="info-grid"><div class="info-card"><div class="info-title">📦 仮想買い情報</div><div>仮想買値：${yen(sim.buyPrice)}</div><div>株数：${sim.quantity}株</div><div class="badge">${sim.feeling || "感情メモなし"}</div><div class="memo">${sim.memo || "メモなし"}</div><button class="small-btn" onclick="openSimBuyModal(${sim.id})">買い情報を編集する</button></div><div class="info-card"><div class="info-title">💰 仮想売り情報</div>${sim.sellPrice !== null && sim.sellPrice !== undefined ? `<div>売ったと仮定した日：${sim.sellDate}</div><div>仮想売値：${yen(sim.sellPrice)}</div><div class="${profitClass(sim.profit)}">仮想損益：${profitText(sim.profit)}</div><button class="small-btn" onclick="openSimSellModal(${sim.id})">売り情報を編集する</button>` : `<div class="memo">まだ売値は記録されていないよ🌸</div><button class="small-btn" onclick="openSimSellModal(${sim.id})">売り情報を記録する</button>`}</div></div><div class="button-row"><button class="small-btn" onclick="openSimLogModal(${sim.id})">途中ログを追加する</button><button class="small-btn" onclick="toggleLogs('${logsId}')">途中ログを見る（${sim.logs.length}件）</button></div><div id="${logsId}" class="collapsible-content">${logsHtml || `<div class="memo">まだ途中経過は記録されていないよ🌸</div>`}</div></div></details>`;
  });
  simTotalProfit.textContent = yen(total); simTotalProfit.className = profitClass(total); simCount.textContent = `${simulations.length}件 / 確定${fixedCount}件`;
}

function openSimBuyModal(id) {
  const sim = simulations.find((s) => s.id === id); if (!sim) return;
  openEditModal("仮想買い情報を編集", `<label>銘柄名</label><input id="editSimName" type="text" value="${sim.name}"><label>買ったと仮定した日</label><input id="editSimBuyDate" type="date" value="${sim.buyDate}"><label>仮想買値</label><input id="editSimBuyPrice" type="number" value="${sim.buyPrice}"><label>株数</label><input id="editSimQuantity" type="number" value="${sim.quantity}"><label>メモ</label><textarea id="editSimMemo">${sim.memo || ""}</textarea>`, "simBuy", id);
}

function saveSimulationBuyEdit() {
  const sim = simulations.find((s) => s.id === editingId); if (!sim) return false;
  const name = document.getElementById("editSimName").value.trim(); const buyPrice = Number(document.getElementById("editSimBuyPrice").value); const quantity = Number(document.getElementById("editSimQuantity").value);
  if (!name || !buyPrice || !quantity) { alert("銘柄名・仮想買値・株数を入力してね🌸"); return false; }
  sim.name = name; sim.buyDate = document.getElementById("editSimBuyDate").value || today(); sim.buyPrice = buyPrice; sim.quantity = quantity; sim.memo = document.getElementById("editSimMemo").value.trim();
  if (sim.sellPrice !== null && sim.sellPrice !== undefined) sim.profit = (sim.sellPrice - sim.buyPrice) * sim.quantity;
  return true;
}

function openSimSellModal(id) {
  const sim = simulations.find((s) => s.id === id); if (!sim) return;
  openEditModal(sim.sellPrice ? "仮想売り情報を編集" : "仮想売り情報を記録", `<label>売ったと仮定した日</label><input id="editSimSellDate" type="date" value="${sim.sellDate || today()}"><label>仮想売値</label><input id="editSimSellPrice" type="number" value="${sim.sellPrice || ""}">`, "simSell", id);
}

function saveSimulationSellEdit() {
  const sim = simulations.find((s) => s.id === editingId); if (!sim) return false;
  const sellPriceInput = document.getElementById("editSimSellPrice").value;
  if (sellPriceInput === "") { sim.sellPrice = null; sim.sellDate = ""; sim.profit = null; return true; }
  sim.sellPrice = Number(sellPriceInput); sim.sellDate = document.getElementById("editSimSellDate").value || today(); sim.profit = (sim.sellPrice - sim.buyPrice) * sim.quantity; return true;
}

function openSimLogModal(simId, logId = null) {
  const sim = simulations.find((s) => s.id === simId); if (!sim) return;
  const log = logId ? sim.logs.find((l) => l.id === logId) : { date: today(), price: "", memo: "" };
  openEditModal(logId ? "仮想途中ログを編集" : "仮想途中ログを追加", `<label>記録日</label><input id="editLogDate" type="date" value="${log.date}"><label>株価</label><input id="editLogPrice" type="number" value="${log.price || ""}"><label>メモ</label><textarea id="editLogMemo">${log.memo || ""}</textarea>`, "priceLog", simId, logId);
}

function savePriceLogEdit() {
  const sim = simulations.find((s) => s.id === editingId); if (!sim) return false;
  const price = Number(document.getElementById("editLogPrice").value); if (!price) { alert("株価を入力してね🌸"); return false; }
  if (editingSubId) { const log = sim.logs.find((l) => l.id === editingSubId); if (!log) return false; log.date = document.getElementById("editLogDate").value || today(); log.price = price; log.memo = document.getElementById("editLogMemo").value.trim(); }
  else { sim.logs.push({ id: Date.now(), date: document.getElementById("editLogDate").value || today(), price, memo: document.getElementById("editLogMemo").value.trim() }); }
  return true;
}

function clearSimulationForm() { document.getElementById("simName").value = ""; document.getElementById("simBuyDate").value = today(); document.getElementById("simBuyPrice").value = ""; document.getElementById("simQuantity").value = ""; document.getElementById("simMemo").value = ""; }

/* 銘柄別まとめ */
function displayStockSummary() {
  const stockSummaryList = document.getElementById("stockSummaryList"); stockSummaryList.innerHTML = "";
  const names = new Set(); trades.forEach((t) => names.add(t.stockName)); watches.forEach((w) => names.add(w.name)); simulations.forEach((s) => names.add(s.name));
  if (names.size === 0) { stockSummaryList.innerHTML = `<div class="item empty">まだ銘柄情報はないよ🌸</div>`; return; }
  Array.from(names).sort().forEach((name) => {
    const stockTrades = trades.filter((t) => t.stockName === name); const stockWatches = watches.filter((w) => w.name === name); const stockSims = simulations.filter((s) => s.name === name);
    const realProfit = stockTrades.reduce((sum, t) => sum + (t.profit || 0), 0); const simProfit = stockSims.reduce((sum, s) => sum + (s.profit || 0), 0);
    const tradeHtml = stockTrades.map((t) => `<div class="log-box">${t.buyDate}：買値 ${yen(t.buyPrice)} / ${t.quantity}株<br>${t.sellPrice !== null && t.sellPrice !== undefined ? `売値 ${yen(t.sellPrice)} / <span class="${profitClass(t.profit)}">${profitText(t.profit)}</span>` : "売値未記録"}<br>${t.memo || "メモなし"}<button class="small-btn" onclick="openTradeBuyModal(${t.id})">実取引を編集</button></div>`).join("");
    const watchHtml = stockWatches.map((w) => `<div class="log-box">${w.date}：${w.status}<br>見ている株価：${yen(w.price)}<br>買いたい価格：${w.targetBuyPrice ? yen(w.targetBuyPrice) : "未設定"}<br>${w.memo || "メモなし"}<button class="small-btn" onclick="editWatch(${w.id})">WATCHを編集</button></div>`).join("");
    const simHtml = stockSims.map((s) => `<div class="log-box">${s.buyDate}：仮想買値 ${yen(s.buyPrice)} / ${s.quantity}株<br>${s.sellPrice !== null && s.sellPrice !== undefined ? `売値 ${yen(s.sellPrice)} / <span class="${profitClass(s.profit)}">${profitText(s.profit)}</span>` : "売値未記録"}<br>${s.memo || "メモなし"}<button class="small-btn" onclick="openSimBuyModal(${s.id})">シミュレーションを編集</button></div>`).join("");
    stockSummaryList.innerHTML += `<details class="item summary-item"><summary class="summary-toggle"><span class="item-header"><span><span class="item-name">${name}</span><span class="date-text">実取引${stockTrades.length}件 / WATCH${stockWatches.length}件 / シミュレーション${stockSims.length}件</span></span><span class="summary-profit"><span class="${profitClass(realProfit)}">実：${profitText(realProfit)}</span><span class="${profitClass(simProfit)}">仮想：${profitText(simProfit)}</span><span class="summary-chevron" aria-hidden="true">⌄</span></span></span></summary><div class="summary-details"><div class="summary-section-title">実取引</div>${tradeHtml || `<div class="memo">実取引なし</div>`}<div class="summary-section-title">WATCH</div>${watchHtml || `<div class="memo">WATCHなし</div>`}<div class="summary-section-title">シミュレーション</div>${simHtml || `<div class="memo">シミュレーションなし</div>`}</div></details>`;
  });
}

/* 成績表 */
function displayStats() {
  const statsList = document.getElementById("statsList"); if (!statsList) return;
  const closedTrades = trades.filter((t) => t.profit !== null && t.profit !== undefined); const winTrades = closedTrades.filter((t) => t.profit > 0); const loseTrades = closedTrades.filter((t) => t.profit < 0); const totalProfit = closedTrades.reduce((sum, t) => sum + t.profit, 0);
  const winRate = closedTrades.length > 0 ? ((winTrades.length / closedTrades.length) * 100).toFixed(1) : "0.0";
  const averageProfit = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + t.profit, 0) / winTrades.length : 0;
  const averageLoss = loseTrades.length > 0 ? loseTrades.reduce((sum, t) => sum + t.profit, 0) / loseTrades.length : 0;
  const bestTrade = closedTrades.length > 0 ? closedTrades.reduce((best, t) => t.profit > best.profit ? t : best) : null; const worstTrade = closedTrades.length > 0 ? closedTrades.reduce((worst, t) => t.profit < worst.profit ? t : worst) : null;
  const tradeLogCount = trades.reduce((sum, t) => sum + ((t.logs || []).length), 0); const simLogCount = simulations.reduce((sum, s) => sum + ((s.logs || []).length), 0); const totalLogCount = tradeLogCount + simLogCount;
  const feelingGroups = {}; closedTrades.forEach((t) => { const feeling = t.feeling || "感情メモなし"; if (!feelingGroups[feeling]) feelingGroups[feeling] = { total: 0, win: 0, profit: 0 }; feelingGroups[feeling].total++; feelingGroups[feeling].profit += t.profit; if (t.profit > 0) feelingGroups[feeling].win++; });
  const feelingHtml = Object.keys(feelingGroups).map((feeling) => { const g = feelingGroups[feeling]; const rate = ((g.win / g.total) * 100).toFixed(1); return `<div class="log-box"><strong>${feeling}</strong><br>勝率：${rate}% / ${g.win}勝 ${g.total - g.win}敗<br>合計損益：<span class="${profitClass(g.profit)}">${profitText(g.profit)}</span></div>`; }).join("");
  statsList.innerHTML = `<div class="stats-grid"><div class="stats-card"><span>総利益</span><strong class="${profitClass(totalProfit)}">${profitText(totalProfit)}</strong></div><div class="stats-card"><span>勝率</span><strong>${winRate}%</strong></div><div class="stats-card"><span>平均利益</span><strong class="plus">${profitText(averageProfit)}</strong></div><div class="stats-card"><span>平均損失</span><strong class="minus">${profitText(averageLoss)}</strong></div><div class="stats-card"><span>一番勝った取引</span><strong class="plus">${bestTrade ? `${bestTrade.stockName} ${profitText(bestTrade.profit)}` : "なし"}</strong></div><div class="stats-card"><span>一番負けた取引</span><strong class="minus">${worstTrade ? `${worstTrade.stockName} ${profitText(worstTrade.profit)}` : "なし"}</strong></div><div class="stats-card"><span>実取引件数</span><strong>${trades.length}件</strong></div><div class="stats-card"><span>売却済み取引</span><strong>${closedTrades.length}件</strong></div><div class="stats-card"><span>WATCH件数</span><strong>${watches.length}件</strong></div><div class="stats-card"><span>シミュレーション件数</span><strong>${simulations.length}件</strong></div><div class="stats-card"><span>途中ログ件数</span><strong>${totalLogCount}件</strong></div></div><div class="item"><h2>🧠 感情別勝率</h2>${feelingHtml || `<div class="memo">売却済みの実取引がまだないよ🌸</div>`}</div>`;
}

/* バックアップ */
function getTotalDataCount() { const tradeLogs = trades.reduce((sum, t) => sum + ((t.logs || []).length), 0); const simLogs = simulations.reduce((sum, s) => sum + ((s.logs || []).length), 0); return trades.length + watches.length + simulations.length + tradeLogs + simLogs; }
function updateBackupReminder() { const reminder = document.getElementById("backupReminder"); if (!reminder) return; const currentCount = getTotalDataCount(); const backupCount = Number(localStorage.getItem("lastBackupCount")) || 0; const diff = currentCount - backupCount; if (diff < 5) { reminder.innerHTML = ""; return; } const messages = ["🌸 5件以上データが増えたよ！バックアップを取っておこう✨", "📈 今日もいっぱい記録したね！バックアップしておこう🥰", "💾 大事なデータが増えてきたよ！保存して守ろう✨", "🌷 未来の自分のためにバックアップを残そう💕"]; const msg = messages[Math.floor(Math.random() * messages.length)]; reminder.innerHTML = `<div class="backup-bubble">${msg}</div>`; }
function exportBackup() { const backupData = { trades, watches, simulations, exportedAt: new Date().toISOString() }; const json = JSON.stringify(backupData, null, 2); const blob = new Blob([json], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `stock-watch-backup-${today()}.json`; a.click(); URL.revokeObjectURL(url); localStorage.setItem("lastBackupCount", getTotalDataCount()); updateBackupReminder(); }
function importBackup(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function (e) { try { const data = JSON.parse(e.target.result); if (!data.trades || !data.watches || !data.simulations) { alert("バックアップファイルの形式が違うみたい🥹"); return; } if (!confirm("今のデータをバックアップの内容で上書きする？")) return; trades = data.trades; watches = data.watches; simulations = data.simulations; migrateOldData(); saveAll(); localStorage.setItem("lastBackupCount", getTotalDataCount()); renderAll(); alert("バックアップを読み込んだよ🌸"); } catch (error) { alert("読み込みに失敗したよ🥹 JSONファイルか確認してね"); } }; reader.readAsText(file); event.target.value = ""; }
