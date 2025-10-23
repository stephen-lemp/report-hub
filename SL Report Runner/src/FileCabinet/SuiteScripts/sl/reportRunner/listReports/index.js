
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

    const icon = document.createElement("span");
    icon.textContent = item.external_report_link ? "📄" : "🧾";
    icon.setAttribute("aria-hidden", "true");

    const pathSpan = document.createElement("span");
    pathSpan.className = "path";
    pathSpan.textContent = folder.path.join(" / ");

    const a = document.createElement("a");
    a.href = item.external_report_link ? item.external_report_link : `${location.href}&action=GET_REPORT_DATA&reportId=${item.id}`;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = item.name || "(untitled)";

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
}
