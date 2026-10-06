/* =====================================================================
   SoftTissueMechaniX — publications engine
   Reads resources/biblio/bibliography.yml (needs js-yaml, loaded from
   cdnjs in the page header) and powers:
     • the "folder" app on publications.qmd   (<div id="pub-app">)
     • the related-publications boxes on research.qmd
                                              (<div class="project-pubs" data-tags="Cornea">)
   Fields used per entry (only title/author/date are mandatory):
     title, author, date, journal, path (URL/DOI link), categories
     (year + type), tags (research themes), and OPTIONAL: image, abstract,
     keywords, doi.
   ===================================================================== */
(function () {
  'use strict';

  var SRC = 'resources/biblio/bibliography.yml';

  // Colours / icons of the generated covers, per research tag
  var THEMES = {
    cornea:   { c1: '#031C59', c2: '#008BD2', icon: '👁️' },
    eye:      { c1: '#0b3d91', c2: '#3fb4e6', icon: '👁️‍🗨️' },
    clot:     { c1: '#5a0f1e', c2: '#D66547', icon: '🩸' },
    hydrogel: { c1: '#0d4d4a', c2: '#2bb3a3', icon: '🧫' },
    magnetic: { c1: '#3b1f66', c2: '#8a63d2', icon: '🧲' },
    others:   { c1: '#1f2a44', c2: '#6c7fa8', icon: '🔬' }
  };
  function theme(tags) {
    for (var i = 0; i < tags.length; i++) { var t = THEMES[tags[i].toLowerCase()]; if (t) return t; }
    return THEMES.others;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function slug(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60); }
  function asArray(v) { return Array.isArray(v) ? v : (v ? String(v).split(/[,|]/).map(function (x) { return x.trim(); }) : []); }

  function normalise(p) {
    var date = String(p.date || '');
    var year = String(p.year || date.slice(0, 4) || '');
    var cats = asArray(p.categories).map(String);
    var type = cats.filter(function (c) { return c !== year && !/^\d{4}$/.test(c); })[0] || '';
    var url = p.path || p.url || (p.doi ? (String(p.doi).indexOf('http') === 0 ? p.doi : 'https://doi.org/' + p.doi) : '');
    var doi = p.doi || (url.match(/10\.\d{4,}\/\S+/) || [''])[0];
    var tags = asArray(p.tags).map(String);
    return {
      id: p.id || slug(p.title || url),
      title: p.title || '', authors: p.author || p.authors || '', journal: p.journal || '',
      date: date, year: year, type: type, url: url, doi: doi, tags: tags,
      keywords: p.keywords || '', abstract: p.abstract || '', image: p.image || '',
      theme: theme(tags)
    };
  }

  var cache = null;
  function load(src) {
    if (cache) return cache;
    cache = fetch(src || SRC)
      .then(function (r) { if (!r.ok) throw new Error('bibliography.yml not found'); return r.text(); })
      .then(function (txt) {
        return (window.jsyaml.load(txt) || []).map(normalise)
          .sort(function (a, b) { return b.date.localeCompare(a.date); });
      });
    return cache;
  }
  function matches(pub, tags) {
    var low = tags.map(function (t) { return t.toLowerCase(); });
    return pub.tags.some(function (t) { return low.indexOf(t.toLowerCase()) >= 0; });
  }

  function coverHTML(p) {
    if (p.image) return '<img class="pub-card-img" src="' + esc(p.image) + '" alt="" loading="lazy">';
    return '<div class="pub-cover" style="--c1:' + p.theme.c1 + ';--c2:' + p.theme.c2 + '">' +
      '<span class="pc-type">' + esc(p.type || 'Publication') + '</span>' +
      '<span class="pc-icon" aria-hidden="true">' + p.theme.icon + '</span>' +
      '<div><div class="pc-year">' + esc(p.year) + '</div><div class="pc-journal">' + esc(p.journal) + '</div></div>' +
      '</div>';
  }

  /* -------------------------------------------------------------------
     A. Research page: related-publication boxes
     ------------------------------------------------------------------- */
  function initProjectBoxes(boxes) {
    load().then(function (pubs) {
      boxes.forEach(function (box) {
        var tags = asArray(box.dataset.tags);
        var max = +(box.dataset.max || 3);
        var list = pubs.filter(function (p) { return matches(p, tags); });
        var btn = box.parentElement.querySelector('.project-pubs-btn');
        if (btn) {
          btn.href = 'publications.html?tag=' + encodeURIComponent(tags.join(','));
          btn.textContent = list.length ? '📚 See all ' + list.length + ' related publication' + (list.length > 1 ? 's' : '') : '📚 Browse all publications';
          if (!list.length) btn.href = 'publications.html';
        }
        if (!list.length) return;
        box.classList.add('has-pubs');
        box.innerHTML = '<div class="pp-title">Latest related publications</div><ul>' +
          list.slice(0, max).map(function (p) {
            return '<li><a href="publications.html#' + esc(p.id) + '">' + esc(p.title) + '</a>' +
              '<span class="pp-meta">' + esc(p.journal) + ' · ' + esc(p.year) +
              (p.url ? ' · <a href="' + esc(p.url) + '" target="_blank" rel="noopener">DOI ↗</a>' : '') + '</span></li>';
          }).join('') + '</ul>';
      });
    }).catch(function (e) { console.warn(e); });
  }

  /* -------------------------------------------------------------------
     B. Publications page: folder app
     ------------------------------------------------------------------- */
  function initApp(app) {
    var tabsEl = app.querySelector('#pub-tabs');
    var gridEl = app.querySelector('#pub-grid');
    var detailEl = app.querySelector('#pub-detail');
    var searchEl = app.querySelector('#pub-search');
    var countEl = app.querySelector('#pub-count');
    var params = new URLSearchParams(location.search);
    var tagFilter = asArray(params.get('tag') || params.get('search') || '');
    var pubs = [], years = [], current = 'All', query = '';

    load().then(function (data) {
      pubs = data;
      years = Array.from(new Set(pubs.map(function (p) { return p.year; }))).sort().reverse();
      current = tagFilter.length ? 'All' : (years[0] || 'All');
      renderTabs(); renderGrid();
      if (location.hash.length > 1) openById(decodeURIComponent(location.hash.slice(1)));
    }).catch(function (e) {
      gridEl.innerHTML = '<p><em>Could not load the publication list (' + esc(e.message) + ').</em></p>';
    });

    function visible() {
      var q = query.toLowerCase();
      return pubs.filter(function (p) {
        if (tagFilter.length && !matches(p, tagFilter)) return false;
        if (!tagFilter.length && !q && current !== 'All' && p.year !== current) return false;
        if (q) {
          var hay = [p.title, p.authors, p.journal, p.keywords, p.abstract, p.type, p.year, p.tags.join(' ')].join(' ').toLowerCase();
          return hay.indexOf(q) >= 0;
        }
        return true;
      });
    }

    function renderTabs() {
      var counts = {};
      pubs.forEach(function (p) { counts[p.year] = (counts[p.year] || 0) + 1; });
      var list = ['All'].concat(years);
      tabsEl.innerHTML = '';
      list.forEach(function (y) {
        var t = document.createElement('button');
        t.type = 'button';
        t.className = 'pub-tab' + (y === current && !query && !tagFilter.length ? ' active' : '');
        t.innerHTML = esc(y) + '<span class="n">' + (y === 'All' ? pubs.length : counts[y]) + '</span>';
        t.addEventListener('click', function () {
          current = y; query = ''; if (searchEl) searchEl.value = '';
          if (tagFilter.length) { tagFilter = []; history.replaceState(null, '', location.pathname); }
          closeDetail(); renderTabs(); renderGrid();
        });
        tabsEl.appendChild(t);
      });
    }

    function renderGrid() {
      var list = visible();
      var html = '';
      if (tagFilter.length) {
        html += '<div class="pub-filter-note"><h4 style="margin-top:0">Publications related to: <span style="color:var(--stm-blue)">' +
          esc(tagFilter.join(', ')) + '</span></h4>' +
          '<a href="publications.html" class="btn btn-sm btn-outline-primary rounded-pill mb-2">Clear filter ✕</a></div>';
      }
      if (!list.length) html += '<p class="pub-filter-note">No publication found.</p>';
      gridEl.innerHTML = html;
      list.forEach(function (p, k) {
        var card = document.createElement('div');
        card.className = 'pub-card'; card.tabIndex = 0; card.setAttribute('role', 'button');
        card.setAttribute('aria-label', p.title);
        card.style.animationDelay = Math.min(k * 40, 400) + 'ms';
        card.innerHTML = coverHTML(p) +
          '<div class="pub-card-info"><h4 class="pub-card-title">' + esc(p.title) + '</h4>' +
          '<p class="pub-card-authors">' + esc(p.authors) + '</p></div>';
        card.addEventListener('click', function () { openDetail(p); });
        card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(p); } });
        gridEl.appendChild(card);
      });
      if (countEl) countEl.textContent = list.length + ' publication' + (list.length > 1 ? 's' : '');
    }

    function openById(id) {
      var p = pubs.filter(function (x) { return x.id === id; })[0];
      if (p) openDetail(p, true);
    }

    function openDetail(p, fromHash) {
      gridEl.style.display = 'none'; tabsEl.style.visibility = 'hidden';
      detailEl.classList.add('active');
      detailEl.querySelector('.pub-detail-media').innerHTML = p.image
        ? '<img src="' + esc(p.image) + '" alt="First page">'
        : coverHTML(p);
      detailEl.querySelector('.pub-detail-title').textContent = p.title;
      detailEl.querySelector('.pub-detail-authors').textContent = p.authors;
      detailEl.querySelector('.pub-detail-tags').innerHTML =
        (p.journal ? '<span class="pub-tag">' + esc(p.journal) + '</span>' : '') +
        '<span class="pub-tag alt">' + esc(p.year) + '</span>' +
        (p.type ? '<span class="pub-tag alt">' + esc(p.type) + '</span>' : '') +
        p.tags.map(function (t) { return '<a class="pub-tag accent" style="text-decoration:none" href="publications.html?tag=' + encodeURIComponent(t) + '">#' + esc(t) + '</a>'; }).join('');
      detailEl.querySelector('.pub-actions').innerHTML =
        (p.url ? '<a class="btn btn-primary btn-sm rounded-pill" href="' + esc(p.url) + '" target="_blank" rel="noopener">Read the article ↗</a>' : '') +
        (p.doi ? '<button type="button" class="btn btn-outline-primary btn-sm rounded-pill pub-copy">Copy DOI</button>' : '') +
        '<button type="button" class="btn btn-outline-secondary btn-sm rounded-pill pub-share">Copy link to this page</button>';
      var kw = detailEl.querySelector('.pub-detail-keywords');
      kw.style.display = p.keywords ? '' : 'none';
      kw.querySelector('i').textContent = p.keywords;
      var ab = detailEl.querySelector('.pub-detail-abstract');
      ab.textContent = p.abstract || 'The abstract is available on the publisher’s website.';
      ab.style.fontStyle = p.abstract ? '' : 'italic';

      var copy = detailEl.querySelector('.pub-copy');
      if (copy) copy.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(p.doi); copy.textContent = 'DOI copied ✓'; });
      detailEl.querySelector('.pub-share').addEventListener('click', function (e) {
        var link = location.origin + location.pathname + '#' + p.id;
        navigator.clipboard && navigator.clipboard.writeText(link); e.target.textContent = 'Link copied ✓';
      });
      if (!fromHash) history.replaceState(null, '', location.pathname + location.search + '#' + p.id);
      app.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeDetail() {
      detailEl.classList.remove('active');
      gridEl.style.display = 'grid'; tabsEl.style.visibility = '';
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    }
    detailEl.querySelector('.pub-back-btn').addEventListener('click', closeDetail);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && detailEl.classList.contains('active')) closeDetail(); });

    if (searchEl) searchEl.addEventListener('input', function () {
      query = searchEl.value.trim();
      closeDetail(); renderTabs(); renderGrid();
    });
  }

  function init() {
    var app = document.getElementById('pub-app');
    if (app) initApp(app);
    var boxes = document.querySelectorAll('.project-pubs[data-tags]');
    if (boxes.length) initProjectBoxes(Array.prototype.slice.call(boxes));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
