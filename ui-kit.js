/* =========================================================================
   RESET — UI Kit · lógica de la página del kit
   Equipo: Santino Mosca Jacob · Rodrigo Masek · Facundo De Vichenzo

   No reimplementa ningún componente: los pide a ui.js y a art.js, que son
   los mismos archivos del sitio. Lo único propio del kit es armar las fichas
   (colores, íconos) LEYENDO el sitio, para que nada se copie a mano:
     - los colores salen de las variables CSS de styles.css y brand.css;
     - la lista de íconos sale de art.js;
     - avisos, campos, validación en vivo, montos y QR, de ui.js.
   ========================================================================= */
(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');
  var UI = window.RESETUI;
  var Art = window.RESETArt;

  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ------------------------------ Color ------------------------------- */
  // [token, rol, modo]: "fg" = se usa como texto o acento (contraste sobre el
  // fondo de página); "bg" = se usa como fondo (contraste del texto encima).
  var TOKENS = [
    ['void', 'Fondo de página · RESET Void Black', 'bg'],
    ['surface', 'Tarjetas, paneles y pie', 'bg'],
    ['layer', 'Capas elevadas: campos, avisos, pestañas', 'bg'],
    ['violet', 'Acción principal: botones, pestaña activa, paso actual. Sólo fondos y bordes.', 'fg'],
    ['violet-text', 'Violeta para TEXTO: el #8B30FF no llega a 4,5:1', 'fg'],
    ['cyan', 'Enlaces, foco, información, acento secundario', 'fg'],
    ['green', 'Éxito, tilde de campo válido, paso hecho', 'fg'],
    ['danger', 'Errores, fecha agotada, batería baja', 'fg'],
    ['ink', 'Texto principal', 'fg'],
    ['ink-2', 'Texto secundario y bajadas', 'fg'],
    ['muted', 'Etiquetas, ayudas y datos de apoyo', 'fg'],
    ['line', 'Bordes', 'bg'],
    ['line-2', 'Bordes suaves y divisores', 'bg']
  ];

  var rootStyle = getComputedStyle(document.documentElement);
  function tokenValue(name) { return rootStyle.getPropertyValue('--' + name).trim(); }

  function rgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function luminance(hex) {
    var c = rgb(hex).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // Fórmula de contraste de la WCAG 2.1.
  function contrast(a, b) {
    var l1 = luminance(a), l2 = luminance(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }
  function ratioText(r) { return r.toFixed(1).replace('.', ',') + ':1'; }
  function verdict(r) {
    if (r >= 7) return 'AAA';
    if (r >= 4.5) return 'AA';
    if (r >= 3) return 'sólo texto grande o bordes';
    return 'sólo decorativo';
  }

  var colorsBox = document.querySelector('[data-kit-colors]');
  if (colorsBox) {
    var bg = tokenValue('void'), ink = tokenValue('ink');
    colorsBox.innerHTML = TOKENS.map(function (t) {
      var hex = tokenValue(t[0]);
      var r = t[2] === 'fg' ? contrast(hex, bg) : contrast(ink, hex);
      var how = t[2] === 'fg' ? 'sobre el fondo' : 'texto principal encima';
      return '<div class="kit-swatch">' +
        '<div class="kit-swatch__chip" style="background:var(--' + t[0] + ')"><span class="kit-swatch__hex">' + hex.toUpperCase() + '</span></div>' +
        '<div class="kit-swatch__body"><div class="kit-swatch__name">' + t[0] + '</div>' +
        '<div class="kit-swatch__var">var(--' + t[0] + ')</div>' +
        '<p class="kit-swatch__role">' + t[1] + '</p>' +
        '<p class="kit-swatch__contrast">' + how + ': <b' + (r < 4.5 ? ' class="is-low"' : '') + '>' + ratioText(r) + '</b> · ' + verdict(r) + '</p>' +
        '</div></div>';
    }).join('');
  }
  // Pares sueltos citados en el texto: data-kit-pair="#ffffff|--violet".
  $all('[data-kit-pair]').forEach(function (el) {
    var p = el.getAttribute('data-kit-pair').split('|').map(function (v) { return v.indexOf('--') === 0 ? tokenValue(v.slice(2)) : v; });
    var r = contrast(p[0], p[1]);
    el.textContent = ratioText(r) + ' (' + verdict(r) + ')';
  });

  /* ------------------------------ Íconos ------------------------------ */
  var iconsBox = document.querySelector('[data-kit-icons]');
  if (iconsBox && Art) {
    iconsBox.innerHTML = Art.names.map(function (name) {
      return '<div class="kit-icon">' +
        Art.icon(name, 28) + '<span>' + name + '</span></div>';
    }).join('');
  }

  /* ------------------------------ Montos ------------------------------ */
  $all('[data-kit-money]').forEach(function (el) { el.textContent = UI.money(Number(el.getAttribute('data-kit-money'))); });

  /* ------------------------------ Avisos ------------------------------ */
  // Las muestras son una COPIA del componente real (cloneNode): la cruz no
  // hace nada, para que la ficha no desaparezca. Para verlo funcionar están
  // los botones "Probar", que llaman al mismo RESETUI.toast del sitio.
  $all('[data-kit-toast]').forEach(function (stage) {
    var p = stage.getAttribute('data-kit-toast').split('|');
    stage.appendChild(UI.toastElement(p[0], p[1], p[2]).cloneNode(true));
  });
  var TRY = {
    success: ['Cuenta creada', 'Te damos la bienvenida, Santino. Ya podés elegir tu paquete.'],
    info: ['Cerraste sesión', 'Tus entradas siguen guardadas en tu cuenta'],
    error: ['Entrada no encontrada', 'Esa entrada no está en tu cuenta. Acá están todas las tuyas.']
  };
  $all('[data-kit-try]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.getAttribute('data-kit-try');
      UI.toast(t, TRY[t][0], TRY[t][1]);
    });
  });

  // Alertas: éstas sí se cierran de verdad (con la cruz real), y un botón las
  // vuelve a mostrar.
  function renderAlerts() {
    $all('[data-kit-alert]').forEach(function (box) {
      UI.alert(box, {
        type: box.getAttribute('data-kit-alert'),
        title: box.getAttribute('data-title'),
        html: box.getAttribute('data-html'),
        focus: false
      });
    });
  }
  renderAlerts();
  $all('[data-kit-reset-alerts]').forEach(function (b) { b.addEventListener('click', renderAlerts); });

  /* ------------------------------ Campos ------------------------------ */
  $all('[data-kit-field]').forEach(function (input) {
    var kind = input.getAttribute('data-kit-field');
    var msg = input.getAttribute('data-kit-msg');
    if (kind === 'valid') UI.fieldValid(input);
    if (kind === 'error') UI.fieldError(input, msg);
    if (kind === 'error-action') {
      UI.fieldError(input, msg, {
        href: '#formularios', label: input.getAttribute('data-kit-action'),
        onClick: function (e) { e.preventDefault(); }
      });
    }
  });

  $all('[data-kit-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var input = document.getElementById(btn.getAttribute('data-kit-toggle'));
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Ocultar' : 'Mostrar';
      btn.setAttribute('aria-pressed', String(show));
    });
  });

  // Validación en vivo: el MISMO RESETUI.liveValidate del sitio, con las
  // mismas reglas de correo y de tarjeta.
  var live = document.querySelector('[data-kit-live]');
  if (live) {
    live.addEventListener('submit', function (e) { e.preventDefault(); });
    var card = document.getElementById('kit-live-card');
    card.addEventListener('input', function () {                // formato de a 4, como en la compra
      var d = card.value.replace(/\D/g, '').slice(0, 16);
      card.value = d.replace(/(.{4})(?=.)/g, '$1 ');
    });
    UI.liveValidate({
      'kit-live-email': function (v) {
        var e = v.trim().toLowerCase();
        if (!e) return 'Escribí tu correo';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? '' : 'Revisá el correo: le falta la @ o el dominio, como en nombre@correo.com';
      },
      'kit-live-card': function (v) {
        var n = v.replace(/\D/g, '');
        if (!n) return 'Escribí el número de la tarjeta';
        return n.length === 16 ? '' : 'El número tiene que tener 16 cifras (tiene ' + n.length + ')';
      }
    });
  }

  /* ----------------------------- Carrusel ----------------------------- */
  // Muestra: las flechas mueven la pista de a una tarjeta.
  $all('[data-kit-carousel]').forEach(function (box) {
    var track = box.querySelector('[data-kit-track]');
    function step() { var c = track.children; return c.length > 1 ? c[1].offsetLeft - c[0].offsetLeft : track.clientWidth; }
    box.querySelector('[data-kit-prev]').addEventListener('click', function () { track.scrollBy({ left: -step() }); });
    box.querySelector('[data-kit-next]').addEventListener('click', function () { track.scrollBy({ left: step() }); });
  });

  /* ------------------------------- QR -------------------------------- */
  $all('[data-kit-qr]').forEach(function (c) { UI.drawQR(c, c.getAttribute('data-kit-qr')); });

  /* ----------------------------- Pestañas ----------------------------- */
  // Mismo comportamiento que las del sitio: clic y flechas del teclado.
  $all('[data-kit-tabs]').forEach(function (tabs) {
    var list = $all('[role="tab"]', tabs);
    function select(tab, focus) {
      list.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    }
    list.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = list[(i + 1) % list.length];
        if (e.key === 'ArrowLeft') next = list[(i - 1 + list.length) % list.length];
        if (next) { e.preventDefault(); select(next, true); }
      });
    });
  });
})();
