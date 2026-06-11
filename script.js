let trades = JSON.parse(localStorage.getItem("trades")) || [];
let watches = JSON.parse(localStorage.getItem("watches")) || [];
let simulations = JSON.parse(localStorage.getItem("simulations")) || [];

let editingType = null;
let editingId = null;
let editingSubId = null;

window.onload = function () {
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

function showTab(event, tabId) {
  document.querySelectorAll(".tab-content").forEach((content) => {
    content.classList.remove("active");
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
  });

  document.getElementById(tabId).classList.add("active");
  event.target.classList.add("active");

  if (tabId === "summary") displayStockSummary();
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
}

/* =========================
   モーダル編集
========================= */

function openEditModal(title, fieldsHtml) {
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
  if (editingType === "trade") saveTradeEdit();
  if (editingType === "watch") saveWatchEdit();
  if (editingType === "simulation") saveSimulationEdit();
  if (editingType === "priceLog") savePriceLogEdit();

  saveAll();
  renderAll();
  closeEditModal();
}

function deleteEditingItem() {
  if (!confirm("このデータを削除する？")) return;

  if (editingType === "trade") {
    trades = trades.filter((trade) => trade.id !== editingId);
  }

  if (editingType === "watch") {
    watches = watches.filter((watch) => watch.id !== editingId);
  }

  if (editingType === "simulation") {
    simulations = simulations.filter((sim) => sim.id !== editingId);
  }

  if (editingType === "priceLog") {
    const sim = simulations.find((sim) => sim.id === editingId);
    if (sim) {
      sim.logs = sim.logs.filter((log) => log.id !== editingSubId);
    }
  }

  saveAll();
  renderAll();
  closeEditModal();
}

/* =========================
   実取引
========================= */

function addTrade() {
  const stockName = document.getElementById("stockName").value.trim();
  const date = document.getElementById("tradeDate").value || today();
  const buyPrice = Number(document.getElementById("buyPrice").value);
  const sellPrice = Number(document.getElementById("sellPrice").value);
  const quantity = Number(document.getElementById("quantity").value);
  const feeling = document.getElementById("tradeFeeling").value;
  const memo = document.getElementById("memo").value.trim();

  if (!stockName || !buyPrice || !sellPrice || !quantity) {
    alert("銘柄名・買値・売値・株数を入力してね🌸");
    return;
  }

  trades.unshift({
    id: Date.now(),
    stockName,
    date,
    buyPrice,
    sellPrice,
    quantity,
    feeling,
    memo,
    profit: (sellPrice - buyPrice) * quantity
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

  if (trades.length === 0) {
    tradeList.innerHTML = `<div class="item empty">まだ実取引は記録されていないよ🌸</div>`;
  }

  trades.forEach((trade) => {
    total += trade.profit;

    tradeList.innerHTML += `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-name">${trade.stockName}</div>
            <div class="date-text">${trade.date}</div>
          </div>
          <div class="${profitClass(trade.profit)}">${profitText(trade.profit)}</div>
        </div>

        <div class="memo">
          買値：${yen(trade.buyPrice)} /
          売値：${yen(trade.sellPrice)} /
          株数：${trade.quantity}株
        </div>

        <div class="badge">${trade.feeling || "感情メモなし"}</div>
        <div class="memo">${trade.memo || "メモなし"}</div>

        <button class="small-btn" onclick="editTrade(${trade.id})">編集する</button>
      </div>
    `;
  });

  totalProfit.textContent = yen(total);
  totalProfit.className = profitClass(total);
  tradeCount.textContent = `${trades.length}件`;
}

function editTrade(id) {
  const trade = trades.find((trade) => trade.id === id);
  if (!trade) return;

  editingType = "trade";
  editingId = id;

  openEditModal("実取引を編集", `
    <label>銘柄名</label>
    <input id="editStockName" type="text" value="${trade.stockName}">

    <label>取引日</label>
    <input id="editDate" type="date" value="${trade.date}">

    <label>買値</label>
    <input id="editBuyPrice" type="number" value="${trade.buyPrice}">

    <label>売値</label>
    <input id="editSellPrice" type="number" value="${trade.sellPrice}">

    <label>株数</label>
    <input id="editQuantity" type="number" value="${trade.quantity}">

    <label>メモ</label>
    <textarea id="editMemo">${trade.memo || ""}</textarea>
  `);
}

function saveTradeEdit() {
  const trade = trades.find((trade) => trade.id === editingId);
  if (!trade) return;

  const stockName = document.getElementById("editStockName").value.trim();
  const buyPrice = Number(document.getElementById("editBuyPrice").value);
  const sellPrice = Number(document.getElementById("editSellPrice").value);
  const quantity = Number(document.getElementById("editQuantity").value);

  if (!stockName || !buyPrice || !sellPrice || !quantity) {
    alert("銘柄名・買値・売値・株数を入力してね🌸");
    return;
  }

  trade.stockName = stockName;
  trade.date = document.getElementById("editDate").value || today();
  trade.buyPrice = buyPrice;
  trade.sellPrice = sellPrice;
  trade.quantity = quantity;
  trade.memo = document.getElementById("editMemo").value.trim();
  trade.profit = (sellPrice - buyPrice) * quantity;
}

function clearTradeForm() {
  document.getElementById("stockName").value = "";
  document.getElementById("tradeDate").value = today();
  document.getElementById("buyPrice").value = "";
  document.getElementById("sellPrice").value = "";
  document.getElementById("quantity").value = "";
  document.getElementById("memo").value = "";
}

/* =========================
   WATCH
========================= */

function addWatch() {
  const name = document.getElementById("watchName").value.trim();
  const date = document.getElementById("watchDate").value || today();
  const price = Number(document.getElementById("watchPrice").value);
  const targetBuyPrice = Number(document.getElementById("targetBuyPrice").value);
  const takeProfitPrice = Number(document.getElementById("takeProfitPrice").value);
  const stopLossPrice = Number(document.getElementById("stopLossPrice").value);
  const status = document.getElementById("watchStatus").value;
  const memo = document.getElementById("watchMemo").value.trim();

  if (!name || !price) {
    alert("銘柄名と見ている株価を入力してね🌸");
    return;
  }

  watches.unshift({
    id: Date.now(),
    name,
    date,
    price,
    targetBuyPrice,
    takeProfitPrice,
    stopLossPrice,
    status,
    memo
  });

  saveAll();
  clearWatchForm();
  renderAll();
}

function displayWatches() {
  const watchList = document.getElementById("watchList");
  watchList.innerHTML = "";

  if (watches.length === 0) {
    watchList.innerHTML = `<div class="item empty">まだWATCHリストは空だよ🌸</div>`;
    return;
  }

  watches.forEach((watch) => {
    watchList.innerHTML += `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-name">${watch.name}</div>
            <div class="date-text">${watch.date}</div>
          </div>
          <div class="pending">${yen(watch.price)}</div>
        </div>

        <div class="badge">${watch.status}</div>

        <div class="memo">
          買いたい価格：${watch.targetBuyPrice ? yen(watch.targetBuyPrice) : "未設定"} /
          利確目安：${watch.takeProfitPrice ? yen(watch.takeProfitPrice) : "未設定"} /
          損切り目安：${watch.stopLossPrice ? yen(watch.stopLossPrice) : "未設定"}
        </div>

        <div class="memo">${watch.memo || "メモなし"}</div>

        <button class="small-btn" onclick="editWatch(${watch.id})">編集する</button>
      </div>
    `;
  });
}

function editWatch(id) {
  const watch = watches.find((watch) => watch.id === id);
  if (!watch) return;

  editingType = "watch";
  editingId = id;

  openEditModal("WATCHを編集", `
    <label>銘柄名</label>
    <input id="editWatchName" type="text" value="${watch.name}">

    <label>記録日</label>
    <input id="editWatchDate" type="date" value="${watch.date}">

    <label>見ている株価</label>
    <input id="editWatchPrice" type="number" value="${watch.price}">

    <label>買いたい価格</label>
    <input id="editTargetBuyPrice" type="number" value="${watch.targetBuyPrice || ""}">

    <label>利確目安</label>
    <input id="editTakeProfitPrice" type="number" value="${watch.takeProfitPrice || ""}">

    <label>損切り目安</label>
    <input id="editStopLossPrice" type="number" value="${watch.stopLossPrice || ""}">

    <label>状態</label>
    <select id="editWatchStatus">
      <option ${watch.status === "👀 様子見" ? "selected" : ""}>👀 様子見</option>
      <option ${watch.status === "📉 下がったら買いたい" ? "selected" : ""}>📉 下がったら買いたい</option>
      <option ${watch.status === "📈 上昇トレンド確認中" ? "selected" : ""}>📈 上昇トレンド確認中</option>
      <option ${watch.status === "⚠️ 急落後なので慎重" ? "selected" : ""}>⚠️ 急落後なので慎重</option>
      <option ${watch.status === "⭐ お気に入り" ? "selected" : ""}>⭐ お気に入り</option>
    </select>

    <label>メモ</label>
    <textarea id="editWatchMemo">${watch.memo || ""}</textarea>
  `);
}

function saveWatchEdit() {
  const watch = watches.find((watch) => watch.id === editingId);
  if (!watch) return;

  const name = document.getElementById("editWatchName").value.trim();
  const price = Number(document.getElementById("editWatchPrice").value);

  if (!name || !price) {
    alert("銘柄名と株価を入力してね🌸");
    return;
  }

  watch.name = name;
  watch.date = document.getElementById("editWatchDate").value || today();
  watch.price = price;
  watch.targetBuyPrice = Number(document.getElementById("editTargetBuyPrice").value);
  watch.takeProfitPrice = Number(document.getElementById("editTakeProfitPrice").value);
  watch.stopLossPrice = Number(document.getElementById("editStopLossPrice").value);
  watch.status = document.getElementById("editWatchStatus").value;
  watch.memo = document.getElementById("editWatchMemo").value.trim();
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

/* =========================
   シミュレーション
========================= */

function addSimulation() {
  const name = document.getElementById("simName").value.trim();
  const buyDate = document.getElementById("simBuyDate").value || today();
  const buyPrice = Number(document.getElementById("simBuyPrice").value);
  const quantity = Number(document.getElementById("simQuantity").value);
  const feeling = document.getElementById("simFeeling").value;
  const memo = document.getElementById("simMemo").value.trim();

  if (!name || !buyPrice || !quantity) {
    alert("銘柄名・仮想買値・株数を入力してね🌸");
    return;
  }

  simulations.unshift({
    id: Date.now(),
    name,
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
  clearSimulationForm();
  renderAll();
}

function displaySimulations() {
  const simList = document.getElementById("simList");
  const simTotalProfit = document.getElementById("simTotalProfit");
  const simCount = document.getElementById("simCount");

  simList.innerHTML = "";

  let total = 0;
  let fixedCount = 0;

  if (simulations.length === 0) {
    simList.innerHTML = `<div class="item empty">まだシミュレーションはないよ🌸</div>`;
  }

  simulations.forEach((sim) => {
    if (sim.profit !== null && sim.profit !== undefined) {
      total += sim.profit;
      fixedCount++;
    }

    const logsHtml = sim.logs.map((log) => {
      const diff = (log.price - sim.buyPrice) * sim.quantity;

      return `
        <div class="log-box">
          <strong>${log.date}</strong>：${yen(log.price)}
          <div class="${profitClass(diff)}">買値との差：${profitText(diff)}</div>
          <div>${log.memo || "メモなし"}</div>
          <button class="small-btn" onclick="editPriceLog(${sim.id}, ${log.id})">ログ編集</button>
        </div>
      `;
    }).join("");

    const resultHtml =
      sim.sellPrice !== null && sim.sellPrice !== undefined
        ? `
          <div class="log-box">
            <strong>売値記録</strong><br>
            売ったと仮定した日：${sim.sellDate}<br>
            仮想売値：${yen(sim.sellPrice)}<br>
            <span class="${profitClass(sim.profit)}">仮想損益：${profitText(sim.profit)}</span>
          </div>
        `
        : `
          <div class="log-box">
            <strong>売値記録</strong><br>
            まだ売値は記録されていないよ🌸
          </div>
        `;

    simList.innerHTML += `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-name">${sim.name}</div>
            <div class="date-text">買ったと仮定した日：${sim.buyDate}</div>
          </div>
          <div class="${profitClass(sim.profit)}">${profitText(sim.profit)}</div>
        </div>

        <div class="memo">
          仮想買値：${yen(sim.buyPrice)} /
          株数：${sim.quantity}株
        </div>

        <div class="badge">${sim.feeling || "感情メモなし"}</div>
        <div class="memo">${sim.memo || "メモなし"}</div>

        <button class="small-btn" onclick="editSimulation(${sim.id})">買い情報を編集する</button>

        ${resultHtml}

        <div class="form-mini">
          <div class="log-title">売値を記録・編集</div>
          <label>売ったと仮定した日</label>
          <input id="sellDate-${sim.id}" type="date" value="${sim.sellDate || today()}">
          <input id="sellPrice-${sim.id}" type="number" placeholder="仮想売値" value="${sim.sellPrice || ""}">
          <button class="small-btn" onclick="addSimulationSell(${sim.id})">売値を保存する</button>
        </div>

        <div class="form-mini">
          <div class="log-title">途中の値動きを記録</div>
          <label>記録日</label>
          <input id="logDate-${sim.id}" type="date" value="${today()}">
          <input id="logPrice-${sim.id}" type="number" placeholder="途中の株価">
          <textarea id="logMemo-${sim.id}" placeholder="値動きメモ"></textarea>
          <button class="small-btn" onclick="addPriceLog(${sim.id})">途中経過を追加する</button>
        </div>

        <div class="log-title">途中の値動きログ</div>
        ${logsHtml || `<div class="memo">まだ途中経過は記録されていないよ🌸</div>`}

        <button class="delete-btn" onclick="deleteSimulationDirect(${sim.id})">シミュレーション削除</button>
      </div>
    `;
  });

  simTotalProfit.textContent = yen(total);
  simTotalProfit.className = profitClass(total);
  simCount.textContent = `${simulations.length}件 / 確定${fixedCount}件`;
}

function editSimulation(id) {
  const sim = simulations.find((sim) => sim.id === id);
  if (!sim) return;

  editingType = "simulation";
  editingId = id;

  openEditModal("シミュレーションを編集", `
    <label>銘柄名</label>
    <input id="editSimName" type="text" value="${sim.name}">

    <label>買ったと仮定した日</label>
    <input id="editSimBuyDate" type="date" value="${sim.buyDate}">

    <label>仮想買値</label>
    <input id="editSimBuyPrice" type="number" value="${sim.buyPrice}">

    <label>株数</label>
    <input id="editSimQuantity" type="number" value="${sim.quantity}">

    <label>売ったと仮定した日</label>
    <input id="editSimSellDate" type="date" value="${sim.sellDate || today()}">

    <label>仮想売値</label>
    <input id="editSimSellPrice" type="number" value="${sim.sellPrice || ""}">

    <label>メモ</label>
    <textarea id="editSimMemo">${sim.memo || ""}</textarea>
  `);
}

function saveSimulationEdit() {
  const sim = simulations.find((sim) => sim.id === editingId);
  if (!sim) return;

  const name = document.getElementById("editSimName").value.trim();
  const buyPrice = Number(document.getElementById("editSimBuyPrice").value);
  const quantity = Number(document.getElementById("editSimQuantity").value);
  const sellPriceInput = document.getElementById("editSimSellPrice").value;

  if (!name || !buyPrice || !quantity) {
    alert("銘柄名・仮想買値・株数を入力してね🌸");
    return;
  }

  sim.name = name;
  sim.buyDate = document.getElementById("editSimBuyDate").value || today();
  sim.buyPrice = buyPrice;
  sim.quantity = quantity;
  sim.sellDate = document.getElementById("editSimSellDate").value || "";
  sim.memo = document.getElementById("editSimMemo").value.trim();

  if (sellPriceInput === "") {
    sim.sellPrice = null;
    sim.sellDate = "";
    sim.profit = null;
  } else {
    sim.sellPrice = Number(sellPriceInput);
    sim.sellDate = sim.sellDate || today();
    sim.profit = (sim.sellPrice - sim.buyPrice) * sim.quantity;
  }
}

function addSimulationSell(id) {
  const sellDate = document.getElementById(`sellDate-${id}`).value || today();
  const sellPrice = Number(document.getElementById(`sellPrice-${id}`).value);

  if (!sellPrice) {
    alert("仮想売値を入力してね🌸");
    return;
  }

  const sim = simulations.find((item) => item.id === id);
  if (!sim) return;

  sim.sellDate = sellDate;
  sim.sellPrice = sellPrice;
  sim.profit = (sellPrice - sim.buyPrice) * sim.quantity;

  saveAll();
  renderAll();
}

function addPriceLog(id) {
  const logDate = document.getElementById(`logDate-${id}`).value || today();
  const logPrice = Number(document.getElementById(`logPrice-${id}`).value);
  const logMemo = document.getElementById(`logMemo-${id}`).value.trim();

  if (!logPrice) {
    alert("途中の株価を入力してね🌸");
    return;
  }

  const sim = simulations.find((item) => item.id === id);
  if (!sim) return;

  sim.logs.push({
    id: Date.now(),
    date: logDate,
    price: logPrice,
    memo: logMemo
  });

  saveAll();
  renderAll();
}

function editPriceLog(simId, logId) {
  const sim = simulations.find((sim) => sim.id === simId);
  if (!sim) return;

  const log = sim.logs.find((log) => log.id === logId);
  if (!log) return;

  editingType = "priceLog";
  editingId = simId;
  editingSubId = logId;

  openEditModal("途中ログを編集", `
    <label>記録日</label>
    <input id="editLogDate" type="date" value="${log.date}">

    <label>株価</label>
    <input id="editLogPrice" type="number" value="${log.price}">

    <label>メモ</label>
    <textarea id="editLogMemo">${log.memo || ""}</textarea>
  `);
}

function savePriceLogEdit() {
  const sim = simulations.find((sim) => sim.id === editingId);
  if (!sim) return;

  const log = sim.logs.find((log) => log.id === editingSubId);
  if (!log) return;

  const price = Number(document.getElementById("editLogPrice").value);

  if (!price) {
    alert("株価を入力してね🌸");
    return;
  }

  log.date = document.getElementById("editLogDate").value || today();
  log.price = price;
  log.memo = document.getElementById("editLogMemo").value.trim();
}

function deleteSimulationDirect(id) {
  if (!confirm("このシミュレーションを削除する？")) return;

  simulations = simulations.filter((sim) => sim.id !== id);

  saveAll();
  renderAll();
}

function clearSimulationForm() {
  document.getElementById("simName").value = "";
  document.getElementById("simBuyDate").value = today();
  document.getElementById("simBuyPrice").value = "";
  document.getElementById("simQuantity").value = "";
  document.getElementById("simMemo").value = "";
}

/* =========================
   銘柄別まとめ
========================= */

function displayStockSummary() {
  const stockSummaryList = document.getElementById("stockSummaryList");
  stockSummaryList.innerHTML = "";

  const names = new Set();

  trades.forEach((trade) => names.add(trade.stockName));
  watches.forEach((watch) => names.add(watch.name));
  simulations.forEach((sim) => names.add(sim.name));

  if (names.size === 0) {
    stockSummaryList.innerHTML = `<div class="item empty">まだ銘柄情報はないよ🌸</div>`;
    return;
  }

  Array.from(names).sort().forEach((name) => {
    const stockTrades = trades.filter((trade) => trade.stockName === name);
    const stockWatches = watches.filter((watch) => watch.name === name);
    const stockSims = simulations.filter((sim) => sim.name === name);

    const realProfit = stockTrades.reduce((sum, trade) => sum + trade.profit, 0);
    const simProfit = stockSims.reduce((sum, sim) => {
      if (sim.profit === null || sim.profit === undefined) return sum;
      return sum + sim.profit;
    }, 0);

    const tradeHtml = stockTrades.map((trade) => `
      <div class="log-box">
        ${trade.date}：実損益
        <span class="${profitClass(trade.profit)}">${profitText(trade.profit)}</span><br>
        ${trade.memo || "メモなし"}
        <button class="small-btn" onclick="editTrade(${trade.id})">実取引を編集</button>
      </div>
    `).join("");

    const watchHtml = stockWatches.map((watch) => `
      <div class="log-box">
        ${watch.date}：${watch.status}<br>
        見ている株価：${yen(watch.price)}<br>
        買いたい価格：${watch.targetBuyPrice ? yen(watch.targetBuyPrice) : "未設定"}<br>
        ${watch.memo || "メモなし"}
        <button class="small-btn" onclick="editWatch(${watch.id})">WATCHを編集</button>
      </div>
    `).join("");

    const simHtml = stockSims.map((sim) => `
      <div class="log-box">
        ${sim.buyDate}：仮想買値 ${yen(sim.buyPrice)} / ${sim.quantity}株<br>
        ${
          sim.sellPrice !== null && sim.sellPrice !== undefined
            ? `売値 ${yen(sim.sellPrice)} / <span class="${profitClass(sim.profit)}">${profitText(sim.profit)}</span>`
            : "売値未記録"
        }<br>
        ${sim.memo || "メモなし"}
        <button class="small-btn" onclick="editSimulation(${sim.id})">シミュレーションを編集</button>
      </div>
    `).join("");

    stockSummaryList.innerHTML += `
      <div class="item">
        <div class="item-header">
          <div>
            <div class="item-name">${name}</div>
            <div class="date-text">
              実取引${stockTrades.length}件 / WATCH${stockWatches.length}件 / シミュレーション${stockSims.length}件
            </div>
          </div>
          <div>
            <div class="${profitClass(realProfit)}">実：${profitText(realProfit)}</div>
            <div class="${profitClass(simProfit)}">仮想：${profitText(simProfit)}</div>
          </div>
        </div>

        <div class="summary-section-title">実取引</div>
        ${tradeHtml || `<div class="memo">実取引なし</div>`}

        <div class="summary-section-title">WATCH</div>
        ${watchHtml || `<div class="memo">WATCHなし</div>`}

        <div class="summary-section-title">シミュレーション</div>
        ${simHtml || `<div class="memo">シミュレーションなし</div>`}
      </div>
    `;
  });
}