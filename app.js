const data = window.PSO_DROP_DATA;

const sectionColors = {
  ヴィリディア: "#00c080",
  グリーニル: "#00d94a",
  スカイリー: "#00cce8",
  ブルーフル: "#2354d4",
  パープルナム: "#c752d7",
  ピンカル: "#ff80c0",
  レッドリア: "#e2342f",
  オラン: "#f0a821",
  イエローブーズ: "#e2cc21",
  ホワイティル: "#f4f4f4",
};

const state = {
  episode: data.episodes[0],
  difficulty: data.difficulties[0],
  sections: new Set(data.sectionIds),
  areas: new Set(data.areasByEpisode[data.episodes[0]]),
  query: "",
  sortMode: "area",
  viewMode: "list",
  hideEmpty: true,
  targetsOnly: false,
  targets: new Set(JSON.parse(localStorage.getItem("psoDropTargets") || "[]")),
};

const el = {
  episodeButtons: document.querySelector("#episodeButtons"),
  difficultyButtons: document.querySelector("#difficultyButtons"),
  sectionButtons: document.querySelector("#sectionButtons"),
  allSectionsButton: document.querySelector("#allSectionsButton"),
  areaFilters: document.querySelector("#areaFilters"),
  queryInput: document.querySelector("#queryInput"),
  viewMode: document.querySelector("#viewMode"),
  sortMode: document.querySelector("#sortMode"),
  hideEmpty: document.querySelector("#hideEmpty"),
  targetsOnly: document.querySelector("#targetsOnly"),
  resetButton: document.querySelector("#resetButton"),
  clearTargetsButton: document.querySelector("#clearTargetsButton"),
  visibleCount: document.querySelector("#visibleCount"),
  targetCount: document.querySelector("#targetCount"),
  resultsTitle: document.querySelector("#resultsTitle"),
  resultsSummary: document.querySelector("#resultsSummary"),
  targetPanel: document.querySelector("#targetPanel"),
  targetList: document.querySelector("#targetList"),
  tableHead: document.querySelector("#tableHead"),
  tableBody: document.querySelector("#tableBody"),
};

function getEpisodeAreas() {
  return data.areasByEpisode[state.episode] || [];
}

function saveTargets() {
  localStorage.setItem("psoDropTargets", JSON.stringify([...state.targets]));
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase("ja-JP").trim();
}

function isEmptyDrop(drop) {
  return drop.item === "-----" || drop.rareRate === "-----";
}

function formatPercent(value) {
  if (!value || value === "-----") return value || "";
  const numeric = Number(String(value).replace("%", ""));
  if (!Number.isFinite(numeric)) return value;
  if (numeric > 0 && numeric < 1) {
    return `${numeric.toFixed(2).replace(/\.?0+$/, "")}%`;
  }
  return `${numeric.toFixed(5).replace(/\.?0+$/, "")}%`;
}

function rateSortValue(value, direction) {
  if (value === null || Number.isNaN(value)) return direction === "asc" ? Infinity : -Infinity;
  return value;
}

function compareBase(a, b) {
  const areas = getEpisodeAreas();
  return (
    areas.indexOf(a.area) - areas.indexOf(b.area) ||
    a.enemy.localeCompare(b.enemy, "ja-JP") ||
    data.sectionIds.indexOf(a.sectionId) - data.sectionIds.indexOf(b.sectionId)
  );
}

function getFilteredDrops() {
  const query = normalize(state.query);
  const rows = data.drops.filter((drop) => {
    if (drop.episode !== state.episode) return false;
    if (drop.difficulty !== state.difficulty) return false;
    if (!state.sections.has(drop.sectionId)) return false;
    if (!state.areas.has(drop.area)) return false;
    if (state.hideEmpty && isEmptyDrop(drop)) return false;
    if (state.targetsOnly && !state.targets.has(drop.item)) return false;
    if (!query) return true;
    return (
      normalize(drop.item).includes(query) ||
      normalize(drop.enemy).includes(query) ||
      normalize(drop.area).includes(query) ||
      normalize(drop.sectionId).includes(query)
    );
  });

  rows.sort((a, b) => {
    if (state.sortMode === "rareAsc") {
      return (
        rateSortValue(a.rareRateValue, "asc") - rateSortValue(b.rareRateValue, "asc") ||
        compareBase(a, b)
      );
    }
    if (state.sortMode === "rareDesc") {
      return (
        rateSortValue(b.rareRateValue, "desc") - rateSortValue(a.rareRateValue, "desc") ||
        compareBase(a, b)
      );
    }
    if (state.sortMode === "item") {
      return a.item.localeCompare(b.item, "ja-JP") || compareBase(a, b);
    }
    return compareBase(a, b);
  });

  return rows;
}

function makeCell(text, className = "") {
  const cell = document.createElement("td");
  cell.textContent = text || "";
  if (className) cell.className = className;
  return cell;
}

function makeHeader(labels) {
  el.tableHead.replaceChildren();
  const row = document.createElement("tr");
  labels.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    row.append(th);
  });
  el.tableHead.append(row);
}

function renderAreaDivider(fragment, area, count, colspan) {
  const row = document.createElement("tr");
  row.className = `area-divider area-${area}`;
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  const name = document.createElement("span");
  name.className = "area-name";
  name.textContent = area;
  const total = document.createElement("span");
  total.className = "area-count";
  total.textContent = `${count}件`;
  cell.append(name, total);
  row.append(cell);
  fragment.append(row);
}

function countByArea(rows) {
  return rows.reduce((counts, row) => {
    counts.set(row.area, (counts.get(row.area) || 0) + 1);
    return counts;
  }, new Map());
}

function renderList(rows) {
  makeHeader(["目標", "エリア", "エネミー", "敵ドロップ率", "セクションID", "アイテム", "レア確率", "目安"]);
  el.tableBody.replaceChildren();

  if (!rows.length) {
    renderEmptyState(8);
    return;
  }

  const fragment = document.createDocumentFragment();
  const areaCounts = countByArea(rows);
  let previousArea = "";
  rows.forEach((drop) => {
    if (drop.area !== previousArea) {
      renderAreaDivider(fragment, drop.area, areaCounts.get(drop.area), 8);
      previousArea = drop.area;
    }

    const row = document.createElement("tr");
    row.className = `area-row area-${drop.area}`;
    const targetCell = document.createElement("td");
    const targetButton = document.createElement("button");
    targetButton.className = `target-button ${state.targets.has(drop.item) ? "active" : ""}`;
    targetButton.type = "button";
    targetButton.textContent = state.targets.has(drop.item) ? "★" : "☆";
    targetButton.title = state.targets.has(drop.item) ? "目標から外す" : "目標に追加";
    targetButton.disabled = isEmptyDrop(drop);
    targetButton.addEventListener("click", () => toggleTarget(drop.item));
    targetCell.append(targetButton);

    const sectionCell = makeCell(drop.sectionId);
    sectionCell.style.borderLeft = `5px solid ${sectionColors[drop.sectionId] || "#ccc"}`;

    row.append(
      targetCell,
      makeCell(drop.area),
      makeCell(drop.enemy),
      makeCell(formatPercent(drop.enemyDropRate), "rate"),
      sectionCell,
      makeCell(drop.item, isEmptyDrop(drop) ? "muted" : "item-name"),
      makeCell(formatPercent(drop.rareRate), "rate"),
      makeCell(drop.rareOdds || "", "muted")
    );
    fragment.append(row);
  });
  el.tableBody.append(fragment);
}

function makeGroupKey(drop) {
  return `${drop.area}\u0000${drop.enemy}\u0000${drop.enemyDropRate}`;
}

function renderCompare(rows) {
  const selectedSections = data.sectionIds.filter((section) => state.sections.has(section));
  makeHeader(["エリア", "エネミー", "敵ドロップ率", ...selectedSections]);
  el.tableBody.replaceChildren();

  const groups = new Map();
  rows.forEach((drop) => {
    const key = makeGroupKey(drop);
    if (!groups.has(key)) {
      groups.set(key, {
        area: drop.area,
        enemy: drop.enemy,
        enemyDropRate: drop.enemyDropRate,
        bySection: new Map(),
        rareRateValue: drop.rareRateValue,
      });
    }
    const group = groups.get(key);
    group.bySection.set(drop.sectionId, drop);
    if (drop.rareRateValue !== null) {
      group.rareRateValue =
        group.rareRateValue === null ? drop.rareRateValue : Math.min(group.rareRateValue, drop.rareRateValue);
    }
  });

  const groupedRows = [...groups.values()];
  groupedRows.sort((a, b) => {
    const areas = getEpisodeAreas();
    if (state.sortMode === "rareAsc") {
      return rateSortValue(a.rareRateValue, "asc") - rateSortValue(b.rareRateValue, "asc");
    }
    if (state.sortMode === "rareDesc") {
      return rateSortValue(b.rareRateValue, "desc") - rateSortValue(a.rareRateValue, "desc");
    }
    return areas.indexOf(a.area) - areas.indexOf(b.area) || a.enemy.localeCompare(b.enemy, "ja-JP");
  });

  if (!groupedRows.length) {
    renderEmptyState(3 + selectedSections.length);
    return;
  }

  const fragment = document.createDocumentFragment();
  const areaCounts = countByArea(groupedRows);
  let previousArea = "";
  groupedRows.forEach((group) => {
    if (group.area !== previousArea) {
      renderAreaDivider(fragment, group.area, areaCounts.get(group.area), 3 + selectedSections.length);
      previousArea = group.area;
    }

    const row = document.createElement("tr");
    row.className = `area-row area-${group.area}`;
    row.append(makeCell(group.area), makeCell(group.enemy), makeCell(group.enemyDropRate, "rate"));
    selectedSections.forEach((section) => {
      const drop = group.bySection.get(section);
      const cell = document.createElement("td");
      cell.style.borderLeft = `5px solid ${sectionColors[section] || "#ccc"}`;
      if (!drop) {
        cell.textContent = "";
      } else {
        const item = document.createElement("div");
        item.className = isEmptyDrop(drop) ? "muted" : "item-name";
        item.textContent = drop.item;
        const rate = document.createElement("div");
        rate.className = "muted";
        rate.textContent = drop.rareOdds ? `${formatPercent(drop.rareRate)} / ${drop.rareOdds}` : formatPercent(drop.rareRate);
        cell.append(item, rate);
      }
      row.append(cell);
    });
    fragment.append(row);
  });
  el.tableBody.append(fragment);
}

function renderEmptyState(colspan) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = colspan;
  cell.className = "empty-state";
  cell.textContent = "条件に一致するドロップはありません。";
  row.append(cell);
  el.tableBody.append(row);
}

function renderTargets() {
  const targets = [...state.targets].sort((a, b) => a.localeCompare(b, "ja-JP"));
  el.targetCount.textContent = targets.length;
  el.targetPanel.hidden = targets.length === 0;
  el.targetList.replaceChildren();

  targets.forEach((target) => {
    const chip = document.createElement("span");
    chip.className = "target-chip";
    const label = document.createElement("span");
    label.textContent = target;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "×";
    button.title = "目標から外す";
    button.addEventListener("click", () => toggleTarget(target));
    chip.append(label, button);
    el.targetList.append(chip);
  });
}

function renderSummary(rows) {
  const items = new Set(rows.filter((drop) => !isEmptyDrop(drop)).map((drop) => drop.item));
  const enemies = new Set(rows.map((drop) => drop.enemy));
  el.visibleCount.textContent = rows.length;
  el.resultsTitle.textContent = state.viewMode === "compare" ? "比較ビュー" : "一覧ビュー";
  el.resultsSummary.textContent = `${state.episode} / ${state.difficulty} / ${state.sections.size} ID / ${state.areas.size} エリア / ${items.size} アイテム / ${enemies.size} エネミー`;
}

function renderControls() {
  el.episodeButtons.replaceChildren();
  data.episodes.forEach((episode) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = episode.replace("Episode ", "EP");
    button.className = episode === state.episode ? "active" : "";
    button.addEventListener("click", () => {
      state.episode = episode;
      state.areas = new Set(getEpisodeAreas());
      render();
    });
    el.episodeButtons.append(button);
  });

  el.difficultyButtons.replaceChildren();
  data.difficulties.forEach((difficulty) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = difficulty;
    button.className = difficulty === state.difficulty ? "active" : "";
    button.addEventListener("click", () => {
      state.difficulty = difficulty;
      render();
    });
    el.difficultyButtons.append(button);
  });

  el.sectionButtons.replaceChildren();
  data.sectionIds.forEach((section) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `section-button ${state.sections.has(section) ? "active" : ""}`;
    button.title = `${section}で絞り込み`;
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = sectionColors[section] || "#fff";
    const label = document.createElement("span");
    label.textContent = section;
    button.append(swatch, label);
    button.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        if (state.sections.has(section) && state.sections.size > 1) {
          state.sections.delete(section);
        } else {
          state.sections.add(section);
        }
      } else {
        state.sections = new Set([section]);
      }
      render();
    });
    el.sectionButtons.append(button);
  });

  el.allSectionsButton.textContent = state.sections.size === data.sectionIds.length ? "全解除" : "全選択";

  el.areaFilters.replaceChildren();
  getEpisodeAreas().forEach((area) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = state.areas.has(area);
    input.addEventListener("change", () => {
      if (input.checked) {
        state.areas.add(area);
      } else if (state.areas.size > 1) {
        state.areas.delete(area);
      } else {
        input.checked = true;
      }
      render();
    });
    const span = document.createElement("span");
    span.textContent = area;
    label.append(input, span);
    el.areaFilters.append(label);
  });
}

function render() {
  renderControls();
  renderTargets();
  const rows = getFilteredDrops();
  renderSummary(rows);
  if (state.viewMode === "compare") {
    renderCompare(rows);
  } else {
    renderList(rows);
  }
}

function toggleTarget(item) {
  if (!item || item === "-----") return;
  if (state.targets.has(item)) {
    state.targets.delete(item);
  } else {
    state.targets.add(item);
  }
  saveTargets();
  render();
}

el.allSectionsButton.addEventListener("click", () => {
  if (state.sections.size === data.sectionIds.length) {
    state.sections = new Set([data.sectionIds[0]]);
  } else {
    state.sections = new Set(data.sectionIds);
  }
  render();
});

el.queryInput.addEventListener("input", () => {
  state.query = el.queryInput.value;
  render();
});

el.viewMode.addEventListener("change", () => {
  state.viewMode = el.viewMode.value;
  render();
});

el.sortMode.addEventListener("change", () => {
  state.sortMode = el.sortMode.value;
  render();
});

el.hideEmpty.addEventListener("change", () => {
  state.hideEmpty = el.hideEmpty.checked;
  render();
});

el.targetsOnly.addEventListener("change", () => {
  state.targetsOnly = el.targetsOnly.checked;
  render();
});

el.resetButton.addEventListener("click", () => {
  state.episode = data.episodes[0];
  state.difficulty = data.difficulties[0];
  state.sections = new Set(data.sectionIds);
  state.areas = new Set(getEpisodeAreas());
  state.query = "";
  state.sortMode = "area";
  state.viewMode = "list";
  state.hideEmpty = true;
  state.targetsOnly = false;
  el.queryInput.value = "";
  el.sortMode.value = state.sortMode;
  el.viewMode.value = state.viewMode;
  el.hideEmpty.checked = true;
  el.targetsOnly.checked = false;
  render();
});

el.clearTargetsButton.addEventListener("click", () => {
  state.targets.clear();
  saveTargets();
  render();
});

render();
