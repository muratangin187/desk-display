import { fetchJson, fetchText, openWebPage } from '../bridge.js';

export function initHackerNewsView(rootEl) {
  let stories = [];
  let currentStory = null;
  let activeTab = 'reader';

  rootEl.innerHTML = `
    <div class="hn-container">
      <div class="hn-header">
        <div class="hn-brand">
          <span class="hn-logo">Y</span>
          <span class="hn-heading">Hacker News</span>
        </div>
        <div class="hn-meta-bar">
          <span id="hn-updated">Yükleniyor...</span>
          <button class="pill-btn" id="hn-refresh">↻ Yenile</button>
        </div>
      </div>
      <div class="hn-list" id="hn-list"></div>

      <div class="hn-detail hidden" id="hn-detail">
        <div class="hn-detail-top">
          <button class="hn-back-btn" id="hn-back">← Geri</button>
          <div class="hn-detail-tabs">
            <button class="pill-btn active" data-tab="reader">Okuyucu</button>
            <button class="pill-btn" data-tab="comments">Yorumlar</button>
            <button class="pill-btn" id="hn-open-web">Tarayıcıda Aç ↗</button>
          </div>
        </div>
        <div class="hn-detail-body" id="hn-detail-body"></div>
      </div>
    </div>
  `;

  const listEl = rootEl.querySelector('#hn-list');
  const updatedEl = rootEl.querySelector('#hn-updated');
  const detailEl = rootEl.querySelector('#hn-detail');
  const detailBodyEl = rootEl.querySelector('#hn-detail-body');

  rootEl.querySelector('#hn-refresh').addEventListener('click', loadStories);
  rootEl.querySelector('#hn-back').addEventListener('click', closeDetail);

  rootEl.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      rootEl.querySelectorAll('[data-tab]').forEach((b) =>
        b.classList.toggle('active', b.dataset.tab === activeTab)
      );
      if (currentStory) renderDetailContent();
    });
  });

  rootEl.querySelector('#hn-open-web').addEventListener('click', () => {
    if (!currentStory) return;
    const url = currentStory.url || `https://news.ycombinator.com/item?id=${currentStory.objectID}`;
    openWebPage(url);
  });

  function getDomain(url) {
    if (!url) return 'news.ycombinator.com';
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'link';
    }
  }

  function timeAgo(unixSec) {
    const diff = Math.max(1, Math.floor(Date.now() / 1000 - unixSec));
    if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
    return `${Math.floor(diff / 86400)}g`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async function loadStories() {
    try {
      updatedEl.textContent = 'Güncelleniyor...';
      const data = await fetchJson(
        'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30'
      );
      stories = data.hits || [];
      renderStories();
      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      updatedEl.textContent = `Güncellendi · ${now}`;
    } catch (err) {
      updatedEl.textContent = 'Bağlantı hatası';
      listEl.innerHTML = `<div class="loading-state">Haberler yüklenemedi: ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderStories() {
    listEl.innerHTML = stories
      .map(
        (s, idx) => `
      <article class="hn-card" data-idx="${idx}">
        <div class="hn-card-title">${idx + 1}. ${escapeHtml(s.title)}</div>
        <div class="hn-card-meta">
          <span class="hn-domain">${escapeHtml(getDomain(s.url))}</span>
          <div class="hn-stats">
            <span>▲ ${s.points ?? 0}</span>
            <span>💬 ${s.num_comments ?? 0}</span>
            <span>${timeAgo(s.created_at_i)}</span>
          </div>
        </div>
      </article>
    `
      )
      .join('');

    listEl.querySelectorAll('.hn-card').forEach((card) => {
      card.addEventListener('click', () => {
        openStory(stories[Number(card.dataset.idx)]);
      });
    });
  }

  function openStory(story) {
    currentStory = story;
    activeTab = 'reader';
    rootEl.querySelectorAll('[data-tab]').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === 'reader')
    );
    detailEl.classList.remove('hidden');
    renderDetailContent();
  }

  function closeDetail() {
    currentStory = null;
    detailEl.classList.add('hidden');
  }

  function extractReadableHtml(rawHtml) {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    doc
      .querySelectorAll('script, style, nav, header, footer, aside, iframe, noscript, svg, form')
      .forEach((el) => el.remove());

    const main =
      doc.querySelector('article') ||
      doc.querySelector('main') ||
      doc.querySelector('[role="main"]') ||
      doc.body;

    if (!main) return '<p>İçerik çıkarılamadı.</p>';

    const blocks = [];
    main.querySelectorAll('h1, h2, h3, p, pre, blockquote, li').forEach((el) => {
      const text = el.textContent?.trim();
      if (!text || text.length < 25) return;
      const tag = el.tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        blocks.push(`<${tag}>${escapeHtml(text)}</${tag}>`);
      } else if (tag === 'pre') {
        blocks.push(`<pre>${escapeHtml(text)}</pre>`);
      } else {
        blocks.push(`<p>${escapeHtml(text)}</p>`);
      }
    });

    return blocks.slice(0, 80).join('') || '<p>Bu sayfa okuyucu modunda metin döndürmedi. Sağ üstten "Tarayıcıda Aç" butonunu kullanabilirsiniz.</p>';
  }

  async function renderDetailContent() {
    if (!currentStory) return;
    const s = currentStory;
    const headerHtml = `
      <h1 class="hn-article-title">${escapeHtml(s.title)}</h1>
      <div class="hn-article-meta">
        ${escapeHtml(getDomain(s.url))} · ▲ ${s.points ?? 0} puan · ${escapeHtml(s.author)} · ${s.num_comments ?? 0} yorum
      </div>
    `;

    if (activeTab === 'reader') {
      if (!s.url) {
        detailBodyEl.innerHTML = `${headerHtml}<div class="hn-reader-content">${s.story_text || '<p>Bu bir Ask HN / metin gönderisidir. Yorumlar sekmesine bakabilirsiniz.</p>'}</div>`;
        return;
      }
      detailBodyEl.innerHTML = `${headerHtml}<div class="loading-state">Makale içeriği yükleniyor...</div>`;
      try {
        const html = await fetchText(s.url);
        if (currentStory !== s || activeTab !== 'reader') return;
        detailBodyEl.innerHTML = `${headerHtml}<div class="hn-reader-content">${extractReadableHtml(html)}</div>`;
      } catch (err) {
        if (currentStory !== s || activeTab !== 'reader') return;
        detailBodyEl.innerHTML = `${headerHtml}<div class="loading-state">Okuyucu görünümü yüklenemedi (${escapeHtml(err.message)}). Sağ üstten "Tarayıcıda Aç" ile açabilirsiniz.</div>`;
      }
    } else {
      detailBodyEl.innerHTML = `${headerHtml}<div class="loading-state">Yorumlar yükleniyor...</div>`;
      try {
        const item = await fetchJson(`https://hn.algolia.com/api/v1/items/${s.objectID}`);
        if (currentStory !== s || activeTab !== 'comments') return;
        const comments = (item.children || []).filter((c) => c.text).slice(0, 25);
        if (!comments.length) {
          detailBodyEl.innerHTML = `${headerHtml}<div class="loading-state">Henüz yorum yok.</div>`;
          return;
        }
        detailBodyEl.innerHTML = `
          ${headerHtml}
          <div>
            ${comments
              .map(
                (c) => `
              <div class="hn-comment">
                <div class="hn-comment-author">${escapeHtml(c.author || 'anon')} · ${timeAgo(c.created_at_i)}</div>
                <div class="hn-comment-text">${c.text}</div>
              </div>
            `
              )
              .join('')}
          </div>
        `;
      } catch (err) {
        detailBodyEl.innerHTML = `${headerHtml}<div class="loading-state">Yorumlar yüklenemedi: ${escapeHtml(err.message)}</div>`;
      }
    }
  }

  loadStories();
  setInterval(loadStories, 10 * 60 * 1000);

  return {
    isDetailOpen: () => currentStory !== null,
    closeDetail,
  };
}
