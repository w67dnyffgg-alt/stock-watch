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
    if (!trade.feeling) trade.feeling = "感情メモなし";
    return trade;
  });

  simulations = simulations.map((sim) => {
    if (!sim.logs) sim.logs = [];
    if (!sim.feeling) sim.feeling = "感情メモなし";
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

/* モーダル編集 */

function openEditModal(title, fieldsHtml, options = {}) {
  document.getElementById("editModalTitle").textContent = title;
  document.getElementById("editFields").innerHTML = fieldsHtml;
  const deleteBtn = document.querySelector("#editModal .delete-btn");
  deleteBtn.style.display = options.hideDelete ? "none" : "block";
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

  if (editingType === "trade") ok = saveTradeEdit();
  if (editingType === "tradeSell") ok = saveTradeSellEdit();
  if (editingType === "tradeLog") ok = saveTradeLogEdit();
  if (editingType === "watch") ok = saveWatchEdit();
  if (editingType === "simulation") ok = saveSimulationEdit();
  if (editingType === "simulationSell") ok = saveSimulationSellEdit();
  if (editingType === "priceLog") ok = savePriceLogEdit();
  if (editingType === "addTradeLog") ok = saveNewTradeLog();
  if (editingType === "addPriceLog") ok = saveNewPriceLog();

  if (!ok) return;

  saveAll();
  renderAll();
  closeEditModal();
}

function deleteEditingItem() {
  if (!confirm("このデータを削除する？")) return;

  if (editingType === "trade") trades = trades.filter((trade) => trade.id !== editingId);

  if (editingType === "tradeSell") {
    const trade = trades.find((trade) => trade.id === editingId);
    if (trade) {
      trade.sellDate = "";
      trade.sellPrice = null;
      trade.profit = null;
    }
  }

  if (editingType === "tradeLog") {
    const trade = trades.find((trade) => trade.id === editingId);
    if (trade) trade.logs = trade.logs.filter((log) => log.id !== editingSubId);
  }

  if (editingType === "watch") watches = watches.filter((watch) => watch.id !== editingId);
  if (editingType === "simulation") simulations = simulations.filter((sim) => sim.id !== editingId);

  if (editingType === "simulationSell") {
    const sim = simulations.find((sim) => sim.id === editingId);
    if (sim) {
      sim.sellDate = "";
      sim.sellPrice = null;
      sim.profit = null;
    }
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

  trades.unshift({
    id: Date.now(),
    stockName,
    buyDate,
    buyPrice,
    quantity,
    feeling,
    memo,
    sellDate: "",
    sellPrice: null,
    profit: null,
    logs: []
  });

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
    if (trade.profit !== null && trade.profit !== undefined) {
      total += trade.profit;
      closedCount++;
    }

    const logsHtml = (trade.logs || []).map((log) => {
      const diff = (log.price - trade.buyPrice) * trade.quantity;
      return `
        <div class="log-box">
          <strong>${log.date}</strong>：${yen(log.price)}
          <div class="${profitClass(diff)}">買値との差：${profitText(diff)}</div>
          <div>${log.memo || "メモなし"}</div>
          <button class="small-btn" onclick="editTradeLog(${trade.id}, ${log.id})">ログ編集</button>
        </div>
      `;
    }).join("");

    const sellButtonText = trade.sellPrice !== null && trade.sellPrice !== undefined ? "売り情報を編集する" : "売り情報を記録する";
    const sellHtml = trade.sellPrice !== null && trade.sellPrice !== undefined
      ? `売った日：${trade.sellDate}<br>売値：${yen(trade.sellPrice)}<br><span class="${profitClass(trade.profit)}">実損益：${profitText(trade.profit)}</span>`
      : `まだ売値は記録されていないよ🌸`;

    tradeList.innerHTML += `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-name">${trade.stockName}</div>
            <div class="date-text">買った日：${trade.buyDate}</div>
          </div>
          <div class="${profitClass(trade.profit)}">${profitText(trade.profit)}</div>
        </div>

        <div class="info-section">
          <div class="info-section-title">📦 買い情報</div>
          買値：${yen(trade.buyPrice)} / 株数：${trade.quantity}株<br>
          <span class="badge">${trade.feeling || "感情メモなし"}</span>
          <div class="memo">${trade.memo || "メモなし"}</div>
          <button class="small-btn" onclick="editTrade(${trade.id})">買い情報を編集する</button>
        </div>

        <div class="info-section">
          <div class="info-section-title">💰 売り情報</div>
          <div class="memo">${sellHtml}</div>
          <button class="small-btn" onclick="editTradeSell(${trade.id})">${sellButtonText}</button>
        </div>

        <div class="info-section">
          <div class="info-section-title">📈 途中の値動きログ</div>
          <button class="small-btn" onclick="openAddTradeLog(${trade.id})">途中ログを追加する</button>
          ${logsHtml || `<div class="memo">まだ途中経過は記録されていないよ🌸</div>`}
        </div>
      </div>
    `;
  });

  totalProfit.textContent = yen(total);
  totalProfit.className = profitClass(total);
  tradeCount.textContent = `${trades.length}件 / 売却済み${closedCount}件`;
}

function editTrade(id) {
  const trade = trades.find((trade) => trade.id === id);
  if (!trade) return;
  editingType = "trade";
  editingId = id;

  openEditModal("買い情報を編集", `
    <label>銘柄名</label><input id="editStockName" type="text" value="${trade.stockName}">
    <label>買った日</label><input id="editTradeBuyDate" type="date" value="${trade.buyDate || today()}">
    <label>買値</label><input id="editBuyPrice" type="number" value="${trade.buyPrice}">
    <label>株数</label><input id="editQuantity" type="number" value="${trade.quantity}">
    <label>メモ</label><textarea id="editMemo">${trade.memo || ""}</textarea>
  `);
}

function saveTradeEdit() {
  const trade = trades.find((trade) => trade.id === editingId);
  if (!trade) return false;

  const stockName = document.getElementById("editStockName").value.trim();
  const buyPrice = Number(document.getElementById("editBuyPrice").value);
  const quantity = Number(document.getElementById("editQuantity").value);

  if (!stockName || !buyPrice || !quantity) {
    alert("銘柄名・買値・株数を入力してね🌸");
    return false;
  }

  trade.stockName = stockName;
  trade.buyDate = document.getElementById("editTradeBuyDate").value || today();
  trade.buyPrice = buyPrice;
  trade.quantity = quantity;
  trade.memo = document.getElementById("editMemo").value.trim();

  if (trade.sellPrice !== null && trade.sellPrice !== undefined) {
    trade.profit = (trade.sellPrice - trade.buyPrice) * trade.quantity;
  }
  return true;
}

function editTradeSell(id) {
  const trade = trades.find((trade) => trade.id === id);
  if (!trade) return;
  editingType = "tradeSell";
  editingId = id;

  openEditModal(trade.sellPrice ? "売り情報を編集" : "売り情報を記録", `
    <label>売った日</label><input id="editTradeSellDate" type="date" value="${trade.sellDate || today()}">
    <label>売値</label><input id="editSellPrice" type="number" value="${trade.sellPrice || ""}">
  `, { hideDelete: trade.sellPrice === null || trade.sellPrice === undefined });
}

function saveTradeSellEdit() {
  const trade = trades.find((trade) => trade.id === editingId);
  if (!trade) return false;
  const sellPrice = Number(document.getElementById("editSellPrice").value);
  if (!sellPrice) {
    alert("売値を入力してね🌸");
    return false;
  }
  trade.sellDate = document.getElementById("editTradeSellDate").value || today();
  trade.sellPrice = sellPrice;
  trade.profit = (sellPrice - trade.buyPrice) * trade.quantity;
  return true;
}

function openAddTradeLog(id) {
  editingType = "addTradeLog";
  editingId = id;
  openEditModal("途中ログを追加", `
    <label>記録日</label><input id="newTradeLogDate" type="date" value="${today()}">
    <label>株価</label><input id="newTradeLogPrice" type="number" placeholder="途中の株価">
    <label>メモ</label><textarea id="newTradeLogMemo" placeholder="値動きメモ"></textarea>
  `, { hideDelete: true });
}

function saveNewTradeLog() {
  const trade = trades.find((trade) => trade.id === editingId);
  if (!trade) return false;
  const price = Number(document.getElementById("newTradeLogPrice").value);
  if (!price) {
    alert("株価を入力してね🌸");
    return false;
  }
  trade.logs.push({ id: Date.now(), date: document.getElementById("newTradeLogDate").value || today(), price, memo: document.getElementById("newTradeLogMemo").value.trim() });
  return true;
}

function editTradeLog(tradeId, logId) {
  const trade = trades.find((trade) => trade.id === tradeId);
  if (!trade) return;
  const log = trade.logs.find((log) => log.id === logId);
  if (!log) return;
  editingType = "tradeLog";
  editingId = tradeId;
  editingSubId = logId;
  openEditModal("実取引の途中ログを編集", `
    <label>記録日</label><input id="editTradeLogDate" type="date" value="${log.date}">
    <label>株価</label><input id="editTradeLogPrice" type="number" value="${log.price}">
    <label>メモ</label><textarea id="editTradeLogMemo">${log.memo || ""}</textarea>
  `);
}

function saveTradeLogEdit() {
  const trade = trades.find((trade) => trade.id === editingId);
  if (!trade) return false;
  const log = trade.logs.find((log) => log.id === editingSubId);
  if (!log) return false;
  const price = Number(document.getElementById("editTradeLogPrice").value);
  if (!price) {
    alert("株価を入力してね🌸");
    return false;
  }
  log.date = document.getElementById("editTradeLogDate").value || today();
  log.price = price;
  log.memo = document.getElementById("editTradeLogMemo").value.trim();
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
  const watchList = document.getElementById("watchList");
  watchList.innerHTML = "";
  if (watches.length === 0) { watchList.innerHTML = `<div class="item empty">まだWATCHリストは空だよ🌸</div>`; return; }
  watches.forEach((watch) => {
    watchList.innerHTML += `
      <div class="item">
        <div class="item-header"><div><div class="item-name">${watch.name}</div><div class="date-text">${watch.date}</div></div><div class="pending">${yen(watch.price)}</div></div>
        <div class="badge">${watch.status}</div>
        <div class="memo">買いたい価格：${watch.targetBuyPrice ? yen(watch.targetBuyPrice) : "未設定"} / 利確目安：${watch.takeProfitPrice ? yen(watch.takeProfitPrice) : "未設定"} / 損切り目安：${watch.stopLossPrice ? yen(watch.stopLossPrice) : "未設定"}</div>
        <div class="memo">${watch.memo || "メモなし"}</div>
        <button class="small-btn" onclick="editWatch(${watch.id})">編集する</button>
      </div>`;
  });
}

function editWatch(id) {
  const watch = watches.find((watch) => watch.id === id);
  if (!watch) return;
  editingType = "watch"; editingId = id;
  openEditModal("WATCHを編集", `
    <label>銘柄名</label><input id="editWatchName" type="text" value="${watch.name}">
    <label>記録日</label><input id="editWatchDate" type="date" value="${watch.date}">
    <label>見ている株価</label><input id="editWatchPrice" type="number" value="${watch.price}">
    <label>買いたい価格</label><input id="editTargetBuyPrice" type="number" value="${watch.targetBuyPrice || ""}">
    <label>利確目安</label><input id="editTakeProfitPrice" type="number" value="${watch.takeProfitPrice || ""}">
    <label>損切り目安</label><input id="editStopLossPrice" type="number" value="${watch.stopLossPrice || ""}">
    <label>状態</label><select id="editWatchStatus">
      <option ${watch.status === "👀 様子見" ? "selected" : ""}>👀 様子見</option>
      <option ${watch.status === "📉 下がったら買いたい" ? "selected" : ""}>📉 下がったら買いたい</option>
      <option ${watch.status === "📈 上昇トレンド確認中" ? "selected" : ""}>📈 上昇トレンド確認中</option>
      <option ${watch.status === "⚠️ 急落後なので慎重" ? "selected" : ""}>⚠️ 急落後なので慎重</option>
      <option ${watch.status === "⭐ お気に入り" ? "selected" : ""}>⭐ お気に入り</option>
    </select>
    <label>メモ</label><textarea id="editWatchMemo">${watch.memo || ""}</textarea>
  `);
}

function saveWatchEdit() {
  const watch = watches.find((watch) => watch.id === editingId);
  if (!watch) return false;
  const name = document.getElementById("editWatchName").value.trim();
  const price = Number(document.getElementById("editWatchPrice").value);
  if (!name || !price) { alert("銘柄名と株価を入力してね🌸"); return false; }
  watch.name = name;
  watch.date = document.getElementById("editWatchDate").value || today();
  watch.price = price;
  watch.targetBuyPrice = Number(document.getElementById("editTargetBuyPrice").value);
  watch.takeProfitPrice = Number(document.getElementById("editTakeProfitPrice").value);
  watch.stopLossPrice = Number(document.getElementById("editStopLossPrice").value);
  watch.status = document.getElementById("editWatchStatus").value;
  watch.memo = document.getElementById("editWatchMemo").value.trim();
  return true;
}

function clearWatchForm() {
  document.getElementById("watchName").value = "";
  document.getElementById("watchDate").value = today();
  document.getElementById("watchPrice").value = "";
  document.getElementById("targetBuyPrice").value = "";
  document.getElementById("takeProfitPrice").value = "";
  document.getElementById("stopLossPrice").value = "";
  document.getElementById("watchMemo").value = "";
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
  const simList = document.getElementById("simList");
  const simTotalProfit = document.getElementById("simTotalProfit");
  const simCount = document.getElementById("simCount");
  simList.innerHTML = "";
  let total = 0, fixedCount = 0;
  if (simulations.length === 0) simList.innerHTML = `<div class="item empty">まだシミュレーションはないよ🌸</div>`;
  simulations.forEach((sim) => {
    if (sim.profit !== null && sim.profit !== undefined) { total += sim.profit; fixedCount++; }
    const logsHtml = sim.logs.map((log) => {
      const diff = (log.price - sim.buyPrice) * sim.quantity;
      return `<div class="log-box"><strong>${log.date}</strong>：${yen(log.price)}<div class="${profitClass(diff)}">買値との差：${profitText(diff)}</div><div>${log.memo || "メモなし"}</div><button class="small-btn" onclick="editPriceLog(${sim.id}, ${log.id})">ログ編集</button></div>`;
    }).join("");
    const sellButtonText = sim.sellPrice !== null && sim.sellPrice !== undefined ? "仮想売り情報を編集する" : "仮想売り情報を記録する";
    const sellHtml = sim.sellPrice !== null && sim.sellPrice !== undefined
      ? `売ったと仮定した日：${sim.sellDate}<br>仮想売値：${yen(sim.sellPrice)}<br><span class="${profitClass(sim.profit)}">仮想損益：${profitText(sim.profit)}</span>`
      : `まだ仮想売値は記録されていないよ🌸`;

    simList.innerHTML += `
      <div class="item">
        <div class="item-header"><div><div class="item-name">${sim.name}</div><div class="date-text">買ったと仮定した日：${sim.buyDate}</div></div><div class="${profitClass(sim.profit)}">${profitText(sim.profit)}</div></div>
        <div class="info-section"><div class="info-section-title">📦 買い情報</div>仮想買値：${yen(sim.buyPrice)} / 株数：${sim.quantity}株<br><span class="badge">${sim.feeling || "感情メモなし"}</span><div class="memo">${sim.memo || "メモなし"}</div><button class="small-btn" onclick="editSimulation(${sim.id})">買い情報を編集する</button></div>
        <div class="info-section"><div class="info-section-title">💰 仮想売り情報</div><div class="memo">${sellHtml}</div><button class="small-btn" onclick="editSimulationSell(${sim.id})">${sellButtonText}</button></div>
        <div class="info-section"><div class="info-section-title">📈 途中の値動きログ</div><button class="small-btn" onclick="openAddPriceLog(${sim.id})">途中ログを追加する</button>${logsHtml || `<div class="memo">まだ途中経過は記録されていないよ🌸</div>`}</div>
      </div>`;
  });
  simTotalProfit.textContent = yen(total);
  simTotalProfit.className = profitClass(total);
  simCount.textContent = `${simulations.length}件 / 確定${fixedCount}件`;
}

function editSimulation(id) {
  const sim = simulations.find((sim) => sim.id === id);
  if (!sim) return;
  editingType = "simulation"; editingId = id;
  openEditModal("シミュレーションの買い情報を編集", `
    <label>銘柄名</label><input id="editSimName" type="text" value="${sim.name}">
    <label>買ったと仮定した日</label><input id="editSimBuyDate" type="date" value="${sim.buyDate}">
    <label>仮想買値</label><input id="editSimBuyPrice" type="number" value="${sim.buyPrice}">
    <label>株数</label><input id="editSimQuantity" type="number" value="${sim.quantity}">
    <label>メモ</label><textarea id="editSimMemo">${sim.memo || ""}</textarea>`);
}

function saveSimulationEdit() {
  const sim = simulations.find((sim) => sim.id === editingId);
  if (!sim) return false;
  const name = document.getElementById("editSimName").value.trim();
  const buyPrice = Number(document.getElementById("editSimBuyPrice").value);
  const quantity = Number(document.getElementById("editSimQuantity").value);
  if (!name || !buyPrice || !quantity) { alert("銘柄名・仮想買値・株数を入力してね🌸"); return false; }
  sim.name = name;
  sim.buyDate = document.getElementById("editSimBuyDate").value || today();
  sim.buyPrice = buyPrice;
  sim.quantity = quantity;
  sim.memo = document.getElementById("editSimMemo").value.trim();
  if (sim.sellPrice !== null && sim.sellPrice !== undefined) sim.profit = (sim.sellPrice - sim.buyPrice) * sim.quantity;
  return true;
}

function editSimulationSell(id) {
  const sim = simulations.find((sim) => sim.id === id);
  if (!sim) return;
  editingType = "simulationSell"; editingId = id;
  openEditModal(sim.sellPrice ? "仮想売り情報を編集" : "仮想売り情報を記録", `
    <label>売ったと仮定した日</label><input id="editSimSellDate" type="date" value="${sim.sellDate || today()}">
    <label>仮想売値</label><input id="editSimSellPrice" type="number" value="${sim.sellPrice || ""}">`, { hideDelete: sim.sellPrice === null || sim.sellPrice === undefined });
}

function saveSimulationSellEdit() {
  const sim = simulations.find((sim) => sim.id === editingId);
  if (!sim) return false;
  const sellPrice = Number(document.getElementById("editSimSellPrice").value);
  if (!sellPrice) { alert("仮想売値を入力してね🌸"); return false; }
  sim.sellDate = document.getElementById("editSimSellDate").value || today();
  sim.sellPrice = sellPrice;
  sim.profit = (sellPrice - sim.buyPrice) * sim.quantity;
  return true;
}

function openAddPriceLog(id) {
  editingType = "addPriceLog"; editingId = id;
  openEditModal("途中ログを追加", `
    <label>記録日</label><input id="newLogDate" type="date" value="${today()}">
    <label>株価</label><input id="newLogPrice" type="number" placeholder="途中の株価">
    <label>メモ</label><textarea id="newLogMemo" placeholder="値動きメモ"></textarea>`, { hideDelete: true });
}

function saveNewPriceLog() {
  const sim = simulations.find((sim) => sim.id === editingId);
  if (!sim) return false;
  const price = Number(document.getElementById("newLogPrice").value);
  if (!price) { alert("株価を入力してね🌸"); return false; }
  sim.logs.push({ id: Date.now(), date: document.getElementById("newLogDate").value || today(), price, memo: document.getElementById("newLogMemo").value.trim() });
  return true;
}

function editPriceLog(simId, logId) {
  const sim = simulations.find((sim) => sim.id === simId);
  if (!sim) return;
  const log = sim.logs.find((log) => log.id === logId);
  if (!log) return;
  editingType = "priceLog"; editingId = simId; editingSubId = logId;
  openEditModal("途中ログを編集", `<label>記録日</label><input id="editLogDate" type="date" value="${log.date}"><label>株価</label><input id="editLogPrice" type="number" value="${log.price}"><label>メモ</label><textarea id="editLogMemo">${log.memo || ""}</textarea>`);
}

function savePriceLogEdit() {
  const sim = simulations.find((sim) => sim.id === editingId);
  if (!sim) return false;
  const log = sim.logs.find((log) => log.id === editingSubId);
  if (!log) return false;
  const price = Number(document.getElementById("editLogPrice").value);
  if (!price) { alert("株価を入力してね🌸"); return false; }
  log.date = document.getElementById("editLogDate").value || today();
  log.price = price;
  log.memo = document.getElementById("editLogMemo").value.trim();
  return true;
}

function clearSimulationForm() {
  document.getElementById("simName").value = "";
  document.getElementById("simBuyDate").value = today();
  document.getElementById("simBuyPrice").value = "";
  document.getElementById("simQuantity").value = "";
  document.getElementById("simMemo").value = "";
}

/* 銘柄別まとめ */
function displayStockSummary() {
  const stockSummaryList = document.getElementById("stockSummaryList");
  stockSummaryList.innerHTML = "";
  const names = new Set();
  trades.forEach((trade) => names.add(trade.stockName));
  watches.forEach((watch) => names.add(watch.name));
  simulations.forEach((sim) => names.add(sim.name));
  if (names.size === 0) { stockSummaryList.innerHTML = `<div class="item empty">まだ銘柄情報はないよ🌸</div>`; return; }
  Array.from(names).sort().forEach((name) => {
    const stockTrades = trades.filter((trade) => trade.stockName === name);
    const stockWatches = watches.filter((watch) => watch.name === name);
    const stockSims = simulations.filter((sim) => sim.name === name);
    const realProfit = stockTrades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
    const simProfit = stockSims.reduce((sum, sim) => sum + (sim.profit || 0), 0);
    const tradeHtml = stockTrades.map((trade) => `<div class="log-box">${trade.buyDate}：買値 ${yen(trade.buyPrice)} / ${trade.quantity}株<br>${trade.sellPrice !== null && trade.sellPrice !== undefined ? `売値 ${yen(trade.sellPrice)} / <span class="${profitClass(trade.profit)}">${profitText(trade.profit)}</span>` : "売値未記録"}<br>${trade.memo || "メモなし"}<button class="small-btn" onclick="editTrade(${trade.id})">実取引を編集</button></div>`).join("");
    const watchHtml = stockWatches.map((watch) => `<div class="log-box">${watch.date}：${watch.status}<br>見ている株価：${yen(watch.price)}<br>買いたい価格：${watch.targetBuyPrice ? yen(watch.targetBuyPrice) : "未設定"}<br>${watch.memo || "メモなし"}<button class="small-btn" onclick="editWatch(${watch.id})">WATCHを編集</button></div>`).join("");
    const simHtml = stockSims.map((sim) => `<div class="log-box">${sim.buyDate}：仮想買値 ${yen(sim.buyPrice)} / ${sim.quantity}株<br>${sim.sellPrice !== null && sim.sellPrice !== undefined ? `売値 ${yen(sim.sellPrice)} / <span class="${profitClass(sim.profit)}">${profitText(sim.profit)}</span>` : "売値未記録"}<br>${sim.memo || "メモなし"}<button class="small-btn" onclick="editSimulation(${sim.id})">シミュレーションを編集</button></div>`).join("");
    stockSummaryList.innerHTML += `<div class="item"><div class="item-header"><div><div class="item-name">${name}</div><div class="date-text">実取引${stockTrades.length}件 / WATCH${stockWatches.length}件 / シミュレーション${stockSims.length}件</div></div><div><div class="${profitClass(realProfit)}">実：${profitText(realProfit)}</div><div class="${profitClass(simProfit)}">仮想：${profitText(simProfit)}</div></div></div><div class="summary-section-title">実取引</div>${tradeHtml || `<div class="memo">実取引なし</div>`}<div class="summary-section-title">WATCH</div>${watchHtml || `<div class="memo">WATCHなし</div>`}<div class="summary-section-title">シミュレーション</div>${simHtml || `<div class="memo">シミュレーションなし</div>`}</div>`;
  });
}

/* 成績表 */
function displayStats() {
  const statsList = document.getElementById("statsList");
  if (!statsList) return;
  const closedTrades = trades.filter((trade) => trade.profit !== null && trade.profit !== undefined);
  const winTrades = closedTrades.filter((trade) => trade.profit > 0);
  const loseTrades = closedTrades.filter((trade) => trade.profit < 0);
  const totalProfit = closedTrades.reduce((sum, trade) => sum + trade.profit, 0);
  const winRate = closedTrades.length > 0 ? ((winTrades.length / closedTrades.length) * 100).toFixed(1) : "0.0";
  const averageProfit = winTrades.length > 0 ? winTrades.reduce((sum, trade) => sum + trade.profit, 0) / winTrades.length : 0;
  const averageLoss = loseTrades.length > 0 ? loseTrades.reduce((sum, trade) => sum + trade.profit, 0) / loseTrades.length : 0;
  const bestTrade = closedTrades.length > 0 ? closedTrades.reduce((best, trade) => trade.profit > best.profit ? trade : best) : null;
  const worstTrade = closedTrades.length > 0 ? closedTrades.reduce((worst, trade) => trade.profit < worst.profit ? trade : worst) : null;
  const tradeLogCount = trades.reduce((sum, trade) => sum + ((trade.logs || []).length), 0);
  const simLogCount = simulations.reduce((sum, sim) => sum + ((sim.logs || []).length), 0);
  const totalLogCount = tradeLogCount + simLogCount;
  const feelingGroups = {};
  closedTrades.forEach((trade) => {
    const feeling = trade.feeling || "感情メモなし";
    if (!feelingGroups[feeling]) feelingGroups[feeling] = { total: 0, win: 0, profit: 0 };
    feelingGroups[feeling].total++;
    feelingGroups[feeling].profit += trade.profit;
    if (trade.profit > 0) feelingGroups[feeling].win++;
  });
  const feelingHtml = Object.keys(feelingGroups).map((feeling) => {
    const group = feelingGroups[feeling];
    const rate = ((group.win / group.total) * 100).toFixed(1);
    return `<div class="log-box"><strong>${feeling}</strong><br>勝率：${rate}% / ${group.win}勝 ${group.total - group.win}敗<br>合計損益：<span class="${profitClass(group.profit)}">${profitText(group.profit)}</span></div>`;
  }).join("");
  statsList.innerHTML = `<div class="stats-grid"><div class="stats-card"><span>総利益</span><strong class="${profitClass(totalProfit)}">${profitText(totalProfit)}</strong></div><div class="stats-card"><span>勝率</span><strong>${winRate}%</strong></div><div class="stats-card"><span>平均利益</span><strong class="plus">${profitText(averageProfit)}</strong></div><div class="stats-card"><span>平均損失</span><strong class="minus">${profitText(averageLoss)}</strong></div><div class="stats-card"><span>一番勝った取引</span><strong class="plus">${bestTrade ? `${bestTrade.stockName} ${profitText(bestTrade.profit)}` : "なし"}</strong></div><div class="stats-card"><span>一番負けた取引</span><strong class="minus">${worstTrade ? `${worstTrade.stockName} ${profitText(worstTrade.profit)}` : "なし"}</strong></div><div class="stats-card"><span>実取引件数</span><strong>${trades.length}件</strong></div><div class="stats-card"><span>売却済み取引</span><strong>${closedTrades.length}件</strong></div><div class="stats-card"><span>WATCH件数</span><strong>${watches.length}件</strong></div><div class="stats-card"><span>シミュレーション件数</span><strong>${simulations.length}件</strong></div><div class="stats-card"><span>途中ログ件数</span><strong>${totalLogCount}件</strong></div></div><div class="item"><h2>🧠 感情別勝率</h2>${feelingHtml || `<div class="memo">売却済みの実取引がまだないよ🌸</div>`}</div>`;
}

/* バックアップ */
function getTotalDataCount() {
  const tradeLogs = trades.reduce((sum, trade) => sum + ((trade.logs || []).length), 0);
  const simLogs = simulations.reduce((sum, sim) => sum + ((sim.logs || []).length), 0);
  return trades.length + watches.length + simulations.length + tradeLogs + simLogs;
}
function updateBackupReminder() {
  const reminder = document.getElementById("backupReminder");
  if (!reminder) return;
  const currentCount = getTotalDataCount();
  const backupCount = Number(localStorage.getItem("lastBackupCount")) || 0;
  const diff = currentCount - backupCount;
  if (diff < 5) { reminder.innerHTML = ""; return; }
  const messages = ["🌸 5件以上データが増えたよ！バックアップを取っておこう✨", "📈 今日もいっぱい記録したね！バックアップしておこう🥰", "💾 大事なデータが増えてきたよ！保存して守ろう✨", "🌷 未来の自分のためにバックアップを残そう💕"];
  reminder.innerHTML = `<div class="backup-bubble">${messages[Math.floor(Math.random() * messages.length)]}</div>`;
}
function exportBackup() {
  const backupData = { trades, watches, simulations, exportedAt: new Date().toISOString() };
  const json = JSON.stringify(backupData, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-watch-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  localStorage.setItem("lastBackupCount", getTotalDataCount());
  updateBackupReminder();
}
function importBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.trades || !data.watches || !data.simulations) { alert("バックアップファイルの形式が違うみたい🥹"); return; }
      if (!confirm("今のデータをバックアップの内容で上書きする？")) return;
      trades = data.trades;
      watches = data.watches;
      simulations = data.simulations;
      migrateOldData();
      saveAll();
      localStorage.setItem("lastBackupCount", getTotalDataCount());
      renderAll();
      alert("バックアップを読み込んだよ🌸");
    } catch (error) {
      alert("読み込みに失敗したよ🥹 JSONファイルか確認してね");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}
