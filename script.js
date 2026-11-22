/* ==========================================================
   Body Scent — shared script (product / order / admin)
   ทำงานตามหน้า: ตรวจจาก element id ที่มีอยู่ในหน้านั้นๆ
   ========================================================== */

(function () {
  'use strict';

  /* ---------- Config ---------- */
  var APPS_SCRIPT_URL =
    'https://script.google.com/macros/s/AKfycbwBtHd4MKMYaaHkvJfynMG6_Q2r8Z8oSs_GscC6nYM-1C2vnbzK7sV8psbaSv64yT0Ewg/exec';

  var SHEET_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vTV7TK33FsfsK94ReW0NrXdUxb6fnJ2N4FxCD05Zmg4v8hG3yNrvjslnMmA9SaGGKrMDFEZEHWdEky0/pub?gid=0&single=true&output=csv';

  var MOODS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  var MOOD_LABELS = {
    fresh: 'Fresh',
    sweet: 'Sweet',
    confident: 'Confident',
    romance: 'Romance'
  };

  /* ---------- Helpers ---------- */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(value) {
    var n = Number(String(value).replace(/[^\d.-]/g, ''));
    if (isNaN(n)) return String(value);
    return n.toLocaleString('th-TH');
  }

  /* ==========================================================
     1) product.html — การ์ดสินค้า + ตัวกรอง mood
     ========================================================== */
  function initProductPage() {
    var filterBar = document.getElementById('filter-bar');
    var list = document.getElementById('product-list');
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = 'all';

    // mood เริ่มต้นจาก ?mood=xxx
    var params = new URLSearchParams(window.location.search);
    var moodParam = (params.get('mood') || '').toLowerCase();
    if (MOOD_LABELS[moodParam]) currentMood = moodParam;

    function buildFilterBar() {
      filterBar.classList.add('filter');
      filterBar.textContent = '';
      MOODS.forEach(function (m) {
        var btn = el('button', 'filter__btn');
        btn.type = 'button';
        btn.dataset.mood = m.key;
        btn.setAttribute('aria-pressed', String(m.key === currentMood));
        if (m.key !== 'all') {
          var dot = el('span', 'dot');
          dot.dataset.mood = m.key;
          btn.appendChild(dot);
        }
        btn.appendChild(document.createTextNode(m.label));
        btn.addEventListener('click', function () {
          setMood(m.key);
        });
        filterBar.appendChild(btn);
      });
    }

    function setMood(mood) {
      currentMood = mood;
      Array.prototype.forEach.call(filterBar.querySelectorAll('.filter__btn'), function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.mood === mood));
      });
      // อัปเดต URL ให้แชร์ลิงก์ได้ โดยไม่โหลดหน้าใหม่
      var url = new URL(window.location.href);
      if (mood === 'all') url.searchParams.delete('mood');
      else url.searchParams.set('mood', mood);
      window.history.replaceState(null, '', url);
      renderProducts();
    }

    function sizeLabel(p) {
      if (p.size) return p.size;
      return p.type === 'rollon' ? 'โรลออน' : '';
    }

    // ชื่อสินค้าที่ส่งไปหน้าสั่งซื้อ: ชื่อ + ไซส์ (ถ้ามี)
    function orderItemName(p) {
      return p.size ? p.name + ' ' + p.size : p.name;
    }

    function buildCard(p) {
      var card = el('article', 'product-card');
      card.dataset.mood = p.mood;

      var media = el('div', 'product-card__media');
      var img = el('img');
      img.src = p.image;
      img.alt = p.name;
      img.loading = 'lazy';
      media.appendChild(img);
      card.appendChild(media);

      var mood = el('div', 'product-card__mood');
      mood.appendChild(el('span', 'dot'));
      mood.appendChild(el('span', null, MOOD_LABELS[p.mood] || p.mood));
      card.appendChild(mood);

      card.appendChild(el('h3', 'product-card__name', p.name));
      card.appendChild(el('p', 'product-card__meta', sizeLabel(p)));

      var foot = el('div', 'product-card__foot');
      var price = el('span', 'price', formatPrice(p.price));
      price.appendChild(el('small', null, 'บาท'));
      foot.appendChild(price);

      var buy = el('a', 'btn btn--small', 'สั่งซื้อ');
      buy.href =
        'order.html?item=' + encodeURIComponent(orderItemName(p)) +
        '&price=' + encodeURIComponent(p.price);
      foot.appendChild(buy);

      card.appendChild(foot);
      return card;
    }

    function renderProducts() {
      list.textContent = '';
      var shown = products.filter(function (p) {
        return currentMood === 'all' || p.mood === currentMood;
      });
      if (!shown.length) {
        list.appendChild(el('p', 'muted', 'ไม่พบสินค้าในหมวดนี้'));
        return;
      }
      shown.forEach(function (p) {
        list.appendChild(buildCard(p));
      });
    }

    buildFilterBar();
    list.appendChild(el('p', 'muted', 'กำลังโหลดสินค้า...'));

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = data;
        renderProducts();
      })
      .catch(function (err) {
        console.error(err);
        list.textContent = '';
        list.appendChild(el('p', 'muted', 'โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'));
      });
  }

  /* ==========================================================
     2) order.html — เติมฟอร์มอัตโนมัติ + ส่งคำสั่งซื้อ
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    var itemsInput = document.getElementById('items');
    var totalInput = document.getElementById('total');

    // เติม items และ total จาก URL parameter ทันทีที่โหลดหน้า
    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');
    if (itemsInput && item) itemsInput.value = item;
    if (totalInput && price) totalInput.value = price;

    function val(id) {
      var node = document.getElementById(id);
      return node ? node.value.trim() : '';
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;

      var payload = {
        customerName: val('customerName'),
        contact: val('contact'),
        items: val('items'),
        total: val('total'),
        note: val('note')
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = 'thankyou.html'; })
        .catch(error => {
          console.error(error);
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
          if (submitBtn) submitBtn.disabled = false;
        });
    });
  }

  /* ==========================================================
     3) admin.html — ตารางคำสั่งซื้อจาก Google Sheet (CSV)
     ========================================================== */

  // Parse CSV เอง: รองรับ "..." ที่มีคอมมา/ขึ้นบรรทัดใหม่/"" ข้างใน และ \r\n
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;
    var i = 0;

    if (text.charCodeAt(0) === 0xfeff) i = 1; // ตัด BOM

    for (; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += c;
      }
    }

    // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทิ้ง
    return rows.filter(function (r) {
      return r.some(function (cell) {
        return cell.trim() !== '';
      });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLS = 6;

    function message(text) {
      tbody.textContent = '';
      var tr = el('tr');
      var td = el('td', 'muted', text);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    message('กำลังโหลดข้อมูล...');

    // ใส่ timestamp กัน cache ของ Google Sheets ที่เผยแพร่
    var url = SHEET_CSV_URL + '&_=' + Date.now();

    fetch(url)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // ตัดแถวหัวตาราง

        if (!rows.length) {
          message('ยังไม่มีคำสั่งซื้อ');
          return;
        }

        // แถวใหม่ถูกต่อท้ายชีตเสมอ → กลับลำดับให้ล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.textContent = '';
        rows.forEach(function (r) {
          var tr = el('tr');
          for (var i = 0; i < COLS; i++) {
            var cell = r[i] !== undefined ? r[i].trim() : '';
            if (i === 4 && cell !== '') cell = formatPrice(cell) + ' บาท'; // จำนวนเงินรวม
            tr.appendChild(el('td', null, cell));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        message('โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
