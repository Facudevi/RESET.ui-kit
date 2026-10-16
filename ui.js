/* =========================================================================
   RESET — Sitio final · componentes compartidos
   Equipo: Santino Mosca Jacob · Rodrigo Masek · Facundo De Vichenzo

   Lo usan DOS páginas: el sitio (app.js) y el UI Kit (ui-kit.html). Por eso
   los avisos, los estados de los campos, la validación en vivo y el QR se
   arman ACÁ y en ningún otro lado: el kit muestra exactamente el mismo
   componente que corre en el sitio y no se puede desincronizar.

   Nació de las correcciones del "Análisis de contenido" y de las heurísticas:
   - Punto 1 (toasts): en el mockup el aviso de cuenta creada tenía cruz pero
     no ícono, y el de compra confirmada tenía ícono pero no cruz. Ahora TODO
     aviso lleva ícono a la izquierda y cruz de cierre a la derecha.
   - Punto 3 (errores): título breve en negrita + bajada con la causa y la
     salida, ícono y cierre. Nunca más un bloque de texto plano.
   Depende de art.js (los íconos): cargarlo antes que este archivo.
   ========================================================================= */
(function () {
  'use strict';

  var TYPES = ['success', 'info', 'error'];

  function icon(name, size) {
    return window.RESETArt ? window.RESETArt.icon(name, size) : '';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Montos según el capítulo 8 de "Diseño de contenidos": miles separados con
  // un espacio fino Y DE NO SEPARACIÓN (U+202F) y el signo pegado: $35 000.
  // Se escribe como   a propósito: en el fuente un espacio fino no se
  // distingue a la vista de uno común, y uno común deja partir el monto en
  // dos renglones ("$35" arriba, "000" abajo) en una tarjeta angosta.
  function money(n) {
    return '$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  function typeOf(t) { return TYPES.indexOf(t) === -1 ? 'info' : t; }

  // Esqueleto común de toast y alerta: ícono · cuerpo (título + bajada) · cruz.
  // "bodyHtml" ya viene armado por quien llama (puede traer un enlace o un
  // botón de recuperación); el título va siempre como texto plano.
  function inner(prefix, type, title, bodyHtml, closeLabel) {
    return '<span class="' + prefix + '__icon" aria-hidden="true">' + icon(type, 22) + '</span>' +
      '<div class="' + prefix + '__body">' +
        (title ? '<p class="' + prefix + '__title">' + escapeHtml(title) + '</p>' : '') +
        (bodyHtml ? '<p class="' + prefix + '__text">' + bodyHtml + '</p>' : '') +
      '</div>' +
      '<button class="' + prefix + '__close" type="button" aria-label="' + closeLabel + '">' + icon('close', 18) + '</button>';
  }

  /* ---------------------------- Toast ---------------------------------- */
  // Aviso temporal. type: success | info | error. El texto va escapado: un
  // toast nunca lleva enlaces (se va solo, no se puede depender de él).
  function toastElement(type, title, text) {
    type = typeOf(type);
    var el = document.createElement('div');
    el.className = 'c-toast c-toast--' + type;
    el.setAttribute('data-component', 'Toast/' + type);
    el.innerHTML = inner('c-toast', type, title, text ? escapeHtml(text) : '', 'Cerrar aviso');
    el.querySelector('.c-toast__close').addEventListener('click', function () { el.remove(); });
    return el;
  }

  // Lo agrega a la zona de avisos y lo saca solo. Un error queda más tiempo
  // que una confirmación: hay que leerlo y hacer algo con él. Con el puntero
  // encima no se cierra (no se le escapa a quien lo está leyendo).
  function toast(type, title, text) {
    var box = document.querySelector('.c-toasts');
    var el = toastElement(type, title, text);
    if (!box) return el;
    box.appendChild(el);
    var wait = typeOf(type) === 'error' ? 8000 : 5500;
    var timer = setTimeout(function () { el.remove(); }, wait);
    el.addEventListener('mouseenter', function () { clearTimeout(timer); });
    el.addEventListener('mouseleave', function () { timer = setTimeout(function () { el.remove(); }, 2500); });
    return el;
  }

  /* ---------------------------- Alerta --------------------------------- */
  // Alerta en la página (no se va sola). Llena un contenedor .c-alert que ya
  // existe en el HTML, con su role (alert/status) puesto ahí.
  // opts: { type, title, html, focus }
  function alert(box, opts) {
    if (!box) return;
    var type = typeOf(opts.type);
    TYPES.forEach(function (t) { box.classList.toggle('c-alert--' + t, t === type); });
    box.classList.add('c-alert');
    box.innerHTML = inner('c-alert', type, opts.title, opts.html || '', 'Cerrar mensaje');
    box.hidden = false;
    box.querySelector('.c-alert__close').addEventListener('click', function () { hideAlert(box); });
    if (opts.focus !== false) {
      box.setAttribute('tabindex', '-1');
      box.focus({ preventScroll: false });
    }
  }
  function hideAlert(box) {
    if (!box) return;
    box.hidden = true;
    box.innerHTML = '';
  }

  /* --------------------------- Campos ---------------------------------- */
  // Errores al lado del campo (capítulo 3): nunca "revisá los campos en rojo".
  // "action" es opcional: un enlace de recuperación al final del mensaje
  // ({ href, label, onClick }), por ejemplo "Crear una cuenta con este correo".
  function setFieldError(input, message, action) {
    var field = input.closest('.c-field');
    var err = field.querySelector('.c-field__error');
    field.classList.add('is-invalid');
    field.classList.remove('is-valid');
    input.setAttribute('aria-invalid', 'true');
    err.textContent = message;
    if (action) {
      var a = document.createElement('a');
      a.href = action.href;
      a.className = 'c-field__action';
      a.textContent = action.label;
      if (action.onClick) a.addEventListener('click', action.onClick);
      err.appendChild(document.createTextNode(' '));
      err.appendChild(a);
    }
    err.hidden = false;
  }
  function clearFieldError(input) {
    var field = input.closest('.c-field');
    var err = field.querySelector('.c-field__error');
    field.classList.remove('is-invalid');
    input.removeAttribute('aria-invalid');
    if (err) { err.hidden = true; err.textContent = ''; }
  }
  function markValid(input) {
    clearFieldError(input);
    input.closest('.c-field').classList.add('is-valid');
  }
  function clearField(input) {
    clearFieldError(input);
    input.closest('.c-field').classList.remove('is-valid');
  }

  // Validación EN TIEMPO REAL (heurística 5, gravedad 2: "un borde o ícono
  // verde al completar correctamente un campo"). La regla es no retar a
  // nadie mientras escribe:
  //   - el tilde verde aparece apenas el dato queda bien, sin salir del campo;
  //   - el error aparece recién al salir del campo (o al enviar);
  //   - un error que YA está a la vista se actualiza al escribir y se va
  //     solo en cuanto el dato queda bien.
  // rules = { idDelCampo: function (valor) { return '' o 'mensaje'; } }
  // deps  = { idDelCampo: ['idQueDependeDeÉl'] } (repetir contraseña).
  function liveValidate(rules, deps) {
    Object.keys(rules).forEach(function (id) {
      var input = document.getElementById(id);
      var field = input.closest('.c-field');
      input.setAttribute('data-live', '');
      function evaluate(showError) {
        var msg = rules[id](input.value);
        if (!msg) markValid(input);
        else if (showError || field.classList.contains('is-invalid')) setFieldError(input, msg);
        else clearField(input);
      }
      input.addEventListener('input', function () {
        evaluate(false);
        ((deps && deps[id]) || []).forEach(function (depId) {
          var dep = document.getElementById(depId);
          if (dep.value) dep.dispatchEvent(new Event('input'));
        });
      });
      // Un error que trae un enlace de recuperación ("Crear una cuenta con
      // este correo") NO se rearma al salir del campo: tocar el enlace saca
      // el foco del campo ANTES del clic, y si el blur rehiciera el mensaje
      // el enlace desaparecería bajo el dedo. Ese error se va al escribir.
      input.addEventListener('blur', function () {
        if (!input.value || field.querySelector('.c-field__action')) return;
        evaluate(true);
      });
    });
  }

  /* ----------------------------- QR ------------------------------------ */
  // QR SIMULADO: un dibujo con la forma de un QR (los tres cuadrados de
  // las esquinas + módulos generados a partir del código de la entrada).
  // Siempre da el mismo dibujo para el mismo código. No se puede escanear:
  // en producción lo genera el sistema de entradas.
  function drawQR(canvas, text) {
    var N = 25, quiet = 2, total = N + quiet * 2;
    var ctx = canvas.getContext('2d');
    var cell = Math.floor(canvas.width / total);
    var offset = Math.floor((canvas.width - cell * total) / 2);
    var seed = 0;
    for (var i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
    function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

    ctx.fillStyle = '#EEEEF8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050508';
    function mod(x, y) { ctx.fillRect(offset + (x + quiet) * cell, offset + (y + quiet) * cell, cell, cell); }
    function inFinder(x, y) {
      return (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
    }
    function finder(fx, fy) {
      for (var y = 0; y < 7; y++) for (var x = 0; x < 7; x++) {
        var edge = x === 0 || y === 0 || x === 6 || y === 6;
        var core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) mod(fx + x, fy + y);
      }
    }
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
      if (!inFinder(x, y) && rand() > 0.52) mod(x, y);
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
  }

  window.RESETUI = {
    money: money,
    escapeHtml: escapeHtml,
    toast: toast,
    toastElement: toastElement,
    alert: alert,
    hideAlert: hideAlert,
    fieldError: setFieldError,
    fieldClearError: clearFieldError,
    fieldValid: markValid,
    fieldClear: clearField,
    liveValidate: liveValidate,
    drawQR: drawQR
  };
})();
