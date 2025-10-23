
jQuery(document).ready(function () {
  require(['N/query', 'N/runtime', 'N/currentRecord'], (query, runtime, currentRecord) => {
    window.cr = currentRecord.get();
    window.query = query;
    window.runtime = runtime;
    setupPage();
  });
});


function getReportDefinitions() {
  return query.runSuiteQL({
    query: `select id, name, custrecord_slrrc_category,custrecord_slrrc_externalreportlink external_report_link from 	customrecord_sl_reportrunnerconfig where isinactive = 'F' AND  CASE 
        WHEN BUILTIN.MNFILTER(custrecord_slrrc_availableto, 'MN_INCLUDE', '', 'TRUE', ?) = 'TRUE' THEN 'T' 
        WHEN NVL(custrecord_slrrc_availabletoall,'F') = 'T' THEN 'T'
        ELSE 'F' END = 'T'`,
    params: [runtime.getCurrentUser().role]
  }).asMappedResults();
}

function setupPage() {

  window.REPORT_LINKS = getReportDefinitions();
  const DELIM = ":"; // change if needed
  const data = Array.isArray(window.REPORT_LINKS) ? window.REPORT_LINKS : [];
  const treeEl = document.getElementById("tree");
  const searchEl = document.getElementById("search");
  const expandAllBtn = document.getElementById("expandAll");
  const collapseAllBtn = document.getElementById("collapseAll");

  // Build a nested tree structure from flat list
  function buildTree(items, delim) {
    const root = { key: "__root__", path: [], children: new Map(), items: [] };
    for (const it of items) {
      const raw = it.custrecord_slrrc_category || "Uncategorized";
      const parts = raw.split(delim).map(s => s.trim()).filter(Boolean);
      let node = root;
      for (const part of parts) {
        if (!node.children.has(part)) {
          node.children.set(part, { key: part, path: node.path.concat(part), children: new Map(), items: [] });
        }
        node = node.children.get(part);
      }
      node.items.push(it);
    }
    return root;
  }

  // Flatten all folder path keys for expand/collapse all
  function allFolderKeys(root) {
    const out = [];
    (function walk(n) {
      for (const [, child] of n.children) {
        out.push(child.path.join("/"));
        walk(child);
      }
    })(root);
    return out;
  }

  // Render tree to DOM
  const expanded = new Set(); // pathKey strings for open folders
  let currentFiltered = null;
  const root = buildTree(data, DELIM);
  const allKeys = allFolderKeys(root);

  function iconChevron(open) { return open ? "▾" : "▸"; }
  function esc(str) { return String(str).replace(/[&<>\"]/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[s])); }

  function makeFolderNode(folder) {
    const pathKey = folder.path.join("/");
    const isOpen = expanded.has(pathKey);

    const wrapper = document.createElement("div");
    wrapper.className = "node";
    wrapper.setAttribute("role", "treeitem");
    wrapper.setAttribute("aria-expanded", String(isOpen));
    wrapper.tabIndex = 0;
    wrapper.dataset.pathKey = pathKey;

    const twisty = document.createElement("span");
    twisty.className = "twisty";
    twisty.textContent = iconChevron(isOpen);
    twisty.setAttribute("aria-hidden", "true");

    const folderIcon = document.createElement("span");
    folderIcon.textContent = "📁";
    folderIcon.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "folder";
    name.textContent = folder.key;

    const count = document.createElement("span");
    const totalCount = folder.items.length + countDescendants(folder);
    count.className = "badge";
    count.textContent = totalCount;

    const pathSpan = document.createElement("span");
    pathSpan.className = "path";
    pathSpan.textContent = folder.path.join(" / ");

    wrapper.appendChild(twisty);
    wrapper.appendChild(folderIcon);
    wrapper.appendChild(name);
    wrapper.appendChild(count);
    wrapper.appendChild(pathSpan);

    wrapper.addEventListener("click", (e) => {
      if (e.target === twisty || e.target === wrapper || e.target === name || e.target === folderIcon) {
        toggleFolder(pathKey, wrapper, childrenBlock, twisty);
      }
    });

    wrapper.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        if (!expanded.has(pathKey)) toggleFolder(pathKey, wrapper, childrenBlock, twisty);
        else focusFirstChild(childrenBlock);
      } else if (e.key === "ArrowLeft") {
        if (expanded.has(pathKey)) toggleFolder(pathKey, wrapper, childrenBlock, twisty);
        else focusParent(wrapper);
      }
    });

    const childrenBlock = document.createElement("div");
    childrenBlock.className = "children" + (isOpen ? " open" : "");
    childrenBlock.setAttribute("role", "group");

    // Render items directly under this folder
    for (const it of folder.items) {
      childrenBlock.appendChild(makeItemNode(folder, it));
    }
    // Render subfolders
    for (const [, child] of folder.children) {
      childrenBlock.appendChild(makeFolderNode(child));
    }

    // container
    const container = document.createElement("div");
    container.appendChild(wrapper);
    container.appendChild(childrenBlock);

    return container;
  }

  function countDescendants(node) {
    let total = 0;
    for (const [, child] of node.children) {
      total += child.items.length + countDescendants(child);
    }
    return total;
  }

  function makeItemNode(folder, item) {
    const row = document.createElement("div");
    row.className = "item";
    row.setAttribute("role", "treeitem");
    row.tabIndex = 0;
    row.dataset.reportId = item.id;

    const icon = document.createElement("span");
    icon.textContent = item.external_report_link ? "📄" : "🧾";
    icon.setAttribute("aria-hidden", "true");

    const pathSpan = document.createElement("span");
    pathSpan.className = "path";
    pathSpan.textContent = folder.path.join(" / ");

    const a = document.createElement("a");
    a.textContent = item.name || "(untitled)";
    if (item.external_report_link) {
      a.href = item.external_report_link;
      a.target = "_blank";
      a.rel = "noopener";
    } else {
      a.href = getUrl({ reportId: item.id });
      a.target = "_blank";
      a.rel = "noopener";
      const downloadLink = document.createElement("a");
      downloadLink.href = "#";
      downloadLink.className = "download-link";
      downloadLink.textContent = "Download CSV";
      downloadLink.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        initiateReportDownload(item, row, downloadLink);
      });
      row.appendChild(downloadLink);
    }

    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter") a.click();
      if (e.key === "ArrowLeft") focusParent(row);
      if (e.key === "ArrowRight") a.focus();
    });

    row.appendChild(icon);
    row.appendChild(a);
    row.appendChild(pathSpan);
    return row;
  }

  function focusFirstChild(childrenBlock) {
    const first = childrenBlock.querySelector('[role="treeitem"]');
    if (first) first.focus();
  }
  function focusParent(el) {
    let p = el.previousElementSibling; // the folder header is before the children block or item
    if (!p || !p.matches(".node")) {
      // if this is an item, parent is previousElementSibling of its container
      const maybeNode = el.closest(".children")?.previousElementSibling;
      if (maybeNode && maybeNode.classList.contains("node")) p = maybeNode;
    }
    if (p) p.focus();
  }

  function toggleFolder(pathKey, headerEl, childrenBlock, twistyEl) {
    if (expanded.has(pathKey)) expanded.delete(pathKey);
    else expanded.add(pathKey);
    const isOpen = expanded.has(pathKey);
    headerEl.setAttribute("aria-expanded", String(isOpen));
    childrenBlock.classList.toggle("open", isOpen);
    twistyEl.textContent = iconChevron(isOpen);
  }

  function clearTree() {
    while (treeEl.firstChild) treeEl.removeChild(treeEl.firstChild);
  }

  function render(rootLike) {
    clearTree();
    for (const [, child] of rootLike.children) {
      treeEl.appendChild(makeFolderNode(child));
    }
  }

  function filterTree(node, query) {
    if (!query) return node;
    const q = query.toLowerCase();

    const filtered = {
      key: node.key,
      path: node.path.slice(),
      children: new Map(),
      items: []
    };

    // items
    for (const it of node.items) {
      if (matches(it.name, q) || matches(it.custrecord_slrrc_category || "", q)) {
        filtered.items.push(it);
      }
    }
    // children
    for (const [key, child] of node.children) {
      const fc = filterTree(child, q);
      if (fc && (fc.items.length > 0 || fc.children.size > 0 || matches(key, q))) {
        filtered.children.set(key, fc);
      }
    }
    // keep root regardless
    if (node.path.length === 0) return filtered;
    // prune if empty and name doesn't match
    if (filtered.items.length === 0 && filtered.children.size === 0 && !matches(node.key, q)) {
      return null;
    }
    return filtered;
  }

  function matches(text, q) { return String(text).toLowerCase().includes(q); }

  // Controls
  searchEl.addEventListener("input", () => {
    const q = searchEl.value.trim();
    currentFiltered = q ? filterTree(root, q) : root;
    // Expand all folders along the filtered result (so matches are visible)
    if (q) {
      expanded.clear();
      for (const k of allFolderKeys(currentFiltered)) expanded.add(k);
    }
    render(currentFiltered);
  });

  expandAllBtn.addEventListener("click", () => {
    expanded.clear();
    const src = currentFiltered || root;
    for (const k of allFolderKeys(src)) expanded.add(k);
    render(src);
  });

  collapseAllBtn.addEventListener("click", () => {
    expanded.clear();
    render(currentFiltered || root);
  });

  // Initial render
  // Open top-level folders by default
  for (const [key, child] of root.children) {
    expanded.add(child.path.join("/"));
  }
  render(root);

  async function initiateReportDownload(item, row, linkEl) {
    if (row.dataset.downloading === "true") {
      return;
    }

    if (typeof Papa === "undefined") {
      console.error("PapaParse is required to generate CSV output");
      window.alert("CSV download is unavailable because PapaParse is missing.");
      return;
    }

    row.dataset.downloading = "true";
    row.setAttribute("aria-busy", "true");

    const originalText = linkEl.textContent;
    const originalHref = linkEl.getAttribute("href");
    linkEl.classList.add("downloading");
    linkEl.textContent = "Downloading…";
    linkEl.setAttribute("aria-disabled", "true");
    linkEl.setAttribute("tabindex", "-1");

    const requestGuid = `${window.runtime.getCurrentUser().id}-${Date.now()}-${item.id}`;

    try {
      const data = await retrieveReportData(item.id, requestGuid);
      const csvText = buildCsv(data);
      const fileName = `${sanitizeFileName(item.name || "report")}-${new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .split(".")[0]}.csv`;
      triggerCsvDownload(csvText, fileName);
    } catch (error) {
      console.error("Failed to download report", { error, item });
      window.alert(error?.message || "Unable to download report. Try again or contact an administrator.");
    } finally {
      row.dataset.downloading = "false";
      row.removeAttribute("aria-busy");
      linkEl.classList.remove("downloading");
      linkEl.textContent = originalText;
      linkEl.setAttribute("href", originalHref);
      linkEl.removeAttribute("aria-disabled");
      linkEl.removeAttribute("tabindex");
    }
  }
}

async function retrieveReportData(reportId, requestGuid) {
  const statusUrl = getUrl({ action: "GET_REPORT_DATA", reportId, requestGuid });
  const initialResponse = await makeRequest("POST", statusUrl);
  const parsed = JSON.parse(initialResponse || "{}");
  return resolveReportResponse(parsed, statusUrl, requestGuid);
}

async function resolveReportResponse(response, statusUrl, requestGuid) {
  const status = (response.status || "").toUpperCase();

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (response.dataLink) {
    return getDataFromLink(response.dataLink, requestGuid);
  }

  if (status === "COMPLETE" || status === "SUCCEEDED") {
    if (response.dataLink) {
      return getDataFromLink(response.dataLink, requestGuid);
    }
    if (Array.isArray(response.data)) {
      return response.data;
    }
    return [];
  }

  if (status === "FAILED") {
    throw new Error(response.message || "The report generation task failed.");
  }

  return pollForData(statusUrl, {
    taskId: response.taskId,
    requestGuid: requestGuid || response.requestGuid
  });
}

function pollForData(statusUrl, params, intervalMs = 2000, maxTries = 300) {
  let tries = 0;
  let { taskId, requestGuid } = params || {};

  return new Promise((resolve, reject) => {
    const poll = () => {
      makeRequest("POST", `${statusUrl}&taskId=${taskId || ""}&requestGuid=${requestGuid || ""}`)
        .then((text) => {
          const response = JSON.parse(text || "{}");
          const status = (response.status || "").toUpperCase();

          if (status === "COMPLETE" || status === "SUCCEEDED") {
            if (Array.isArray(response.data)) {
              resolve(response.data);
            } else if (response.dataLink) {
              resolve(getDataFromLink(response.dataLink, requestGuid || response.requestGuid));
            } else {
              resolve([]);
            }
            return;
          }

          if (status === "FAILED") {
            reject(new Error(response.message || "The report generation task failed."));
            return;
          }

          taskId = response.taskId || taskId;
          tries += 1;
          if (tries >= maxTries) {
            reject(new Error("Timed out while waiting for report data."));
            return;
          }
          setTimeout(poll, intervalMs);
        })
        .catch((error) => {
          reject(error);
        });
    };

    poll();
  });
}

function getDataFromLink(dataLink, requestGuid) {
  return fetch(`${window.location.origin}${dataLink}`)
    .then((response) => response.text())
    .then((csvText) => {
      const results = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      makeRequest("POST", getUrl({ action: "DELETE_FILE", requestGuid }));
      return results.data || [];
    });
}

function buildCsv(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return "";
  }
  return Papa.unparse(data);
}

function triggerCsvDownload(csvText, filename) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function sanitizeFileName(name) {
  const cleaned = name.replace(/[^a-z0-9-_]+/gi, "_").replace(/_{2,}/g, "_").replace(/^_+|_+$/g, "");
  return cleaned || "report";
}

function getUrl(parameters = {}) {
  const currentUrl = new URL(window.location.href);
  const newUrl = new URL(currentUrl.origin + currentUrl.pathname);
  const params = currentUrl.searchParams;
  ["script", "deploy"].forEach((key) => {
    const value = params.get(key);
    if (value) newUrl.searchParams.set(key, value);
  });
  Object.keys(parameters || {}).forEach((param) => {
    if (parameters[param] !== undefined && parameters[param] !== null) {
      newUrl.searchParams.set(param, parameters[param]);
    }
  });
  return newUrl.toString();
}

function makeRequest(method, url, body) {
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response);
      } else {
        reject({
          status: xhr.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: xhr.status,
        statusText: xhr.statusText
      });
    };
    xhr.send(body);
  });
}
