/*
 * BastetWalk — gato egipcio dorado de Bastet caminando (ciclo de 8 fotogramas, fondo transparente).
 *
 * Hoja: assets/bastet-walk.webp (8 celdas de 341×253 px, narices y patas alineadas entre celdas).
 * Fotogramas: 1 contacto inicial · 2 apoyo y elevación · 3 paso medio · 4 aceleración ·
 *             5 contacto alterno · 6 apoyo y elevación · 7 paso medio · 8 cierre del ciclo.
 *
 * Uso:
 *   <bastet-walk duration="1000" scale="1" direction="right"></bastet-walk>
 *   const g = new BastetWalk(contenedor, { autoPlay:true, loop:true, duration:1000, scale:1,
 *                                          direction:'right', travel:0, onCycleComplete(n){} });
 *   g.play(); g.pause(); g.setOptions({ duration: 700, direction: 'left' });
 *
 * Opciones (valores por defecto): autoPlay true · loop true · duration 1000 (ms por ciclo) · scale 1
 *   · direction 'right' · travel 0 (px que avanza por ciclo; 0 = caminar en el sitio) · onCycleComplete.
 * Para caminar con desplazamiento: travel = longitud de zancada (≈ 1.9 × ancho del gato) y el avance
 * queda sincronizado con las patas. Respeta prefers-reduced-motion y no bloquea clics.
 */
(function () {
  'use strict';

  var SHEET = 'assets/bastet-walk.webp', COLS = 8, CW = 341, CH = 253, BASE_W = 170; // ancho de una celda con scale = 1
  var reduced = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; };

  // Precarga para evitar parpadeos al primer fotograma.
  var pre = new Image(); pre.src = SHEET;

  /* Pose en la fase 'phase' (0..1 = un ciclo): fotograma, rebote vertical (fracción de la altura) e inclinación del torso (grados). */
  function poseAt(phase) {
    phase = ((phase % 1) + 1) % 1;
    var frame = Math.floor(phase * COLS) % COLS, step = (phase * 2) % 1;
    return {
      frame: frame,
      bob: .012 * Math.sin(Math.PI * step),              // el cuerpo sube en el paso medio y baja en el contacto
      tilt: 1.1 * Math.sin(2 * Math.PI * phase)           // el torso se balancea hacia el lado del apoyo
    };
  }

  function createSprite(width) {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'background:url(' + SHEET + ') no-repeat;background-size:' + COLS * 100 + '% 100%;background-position:0 0;pointer-events:none';
    el.setFrame = function (i) { el.style.backgroundPositionX = (i / (COLS - 1) * 100) + '%'; };
    el.setWidth = function (w) { el.style.width = w + 'px'; el.style.height = (w * CH / CW) + 'px'; };
    el.setWidth(width || BASE_W); el.setFrame(7);
    return el;
  }

  function BastetWalk(host, opts) {
    this.host = host;
    this.autoPlay = true; this.loop = true; this.duration = 1000; this.scale = 1; this.direction = 'right'; this.travel = 0;
    this.onCycleComplete = null; this.playing = false; this.visible = true; this.cycles = 0; this.x = 0;
    this._phase = 0; this._last = 0; this._raf = 0;
    var self = this;

    this.body = document.createElement('div');
    this.body.style.cssText = 'position:absolute;inset:0;transform-origin:50% 100%;will-change:transform;pointer-events:none';
    this.sprite = createSprite(BASE_W);
    this.body.appendChild(this.sprite);
    host.appendChild(this.body);
    host.style.position = host.style.position || 'relative';
    host.style.display = host.style.display || 'inline-block';
    host.style.pointerEvents = 'none';
    this.setOptions(opts || {});
    this._draw(0);

    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; if (self.visible && self.playing) self._start(); }, { threshold: .05 });
      this._io.observe(host);
    }
    if (this.autoPlay) this.play();
  }

  BastetWalk.prototype.setOptions = function (o) {
    for (var k in o) if (o[k] !== undefined) this[k] = o[k];
    var w = BASE_W * this.scale;
    this.host.style.width = w + 'px'; this.host.style.height = (w * CH / CW) + 'px';
    this.sprite.setWidth(w);
    this.body.style.scale = '';
    this._flip = this.direction === 'right' ? -1 : 1; // la hoja original mira a la izquierda
    this._draw(this._phase);
  };

  BastetWalk.prototype._draw = function (phase) {
    var p = poseAt(phase), h = this.sprite.offsetHeight || BASE_W * this.scale * CH / CW;
    this.sprite.setFrame(p.frame);
    this.body.style.transform = 'translate3d(' + this.x + 'px,' + (-p.bob * h) + 'px,0) rotate(' + (p.tilt * -this._flip) + 'deg) scaleX(' + this._flip + ')';
  };

  BastetWalk.prototype._start = function () {
    var self = this; cancelAnimationFrame(this._raf); this._last = 0;
    var tick = function (now) {
      if (!self.playing) return;
      if (!self.visible) { self._last = 0; return; }
      if (self._last) {
        var d = (now - self._last) / self.duration, prev = self._phase;
        self._phase += d;
        if (self.travel) self.x += (self.direction === 'right' ? 1 : -1) * self.travel * d;
        if (self._phase >= 1) {
          self._phase -= 1; self.cycles++;
          if (self.onCycleComplete) self.onCycleComplete(self.cycles);
          if (!self.loop) { self.pause(); self._phase = 0; self._draw(0); return; }
        }
        self._draw(self._phase);
      }
      self._last = now; self._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  };

  BastetWalk.prototype.play = function () {
    if (reduced()) { this._draw(0); return; }
    if (this.playing) return;
    this.playing = true; this._start();
  };
  BastetWalk.prototype.pause = function () { this.playing = false; cancelAnimationFrame(this._raf); };
  BastetWalk.prototype.destroy = function () { this.pause(); if (this._io) this._io.disconnect(); this.host.innerHTML = ''; };

  BastetWalk.poseAt = poseAt;
  BastetWalk.createSprite = createSprite;
  BastetWalk.CELL = { w: CW, h: CH };
  window.BastetWalk = BastetWalk;

  /* <bastet-walk auto-play="true" loop="true" duration="1000" scale="1" direction="right" travel="0"> */
  if (window.customElements && !customElements.get('bastet-walk')) {
    customElements.define('bastet-walk', class extends HTMLElement {
      connectedCallback() {
        var a = this.getAttribute.bind(this), bool = function (n, d) { var v = a(n); return v == null ? d : v !== 'false'; };
        this.walker = new BastetWalk(this, {
          autoPlay: bool('auto-play', true), loop: bool('loop', true), duration: +a('duration') || 1000,
          scale: +a('scale') || 1, direction: a('direction') === 'left' ? 'left' : 'right', travel: +a('travel') || 0,
          onCycleComplete: (n) => this.dispatchEvent(new CustomEvent('cyclecomplete', { detail: n }))
        });
      }
      disconnectedCallback() { if (this.walker) this.walker.destroy(); }
      play() { if (this.walker) this.walker.play(); }
      pause() { if (this.walker) this.walker.pause(); }
    });
  }
})();
