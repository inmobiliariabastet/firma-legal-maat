/*
 * BastetJump — gato egipcio dorado de Bastet con animación de salto por fotogramas.
 *
 * Usa la hoja assets/bastet-sprites.webp (8 fotogramas con fondo transparente).
 * Secuencia: reposo → preparación → impulso → ascenso → punto máximo → descenso → aterrizaje → recuperación.
 *
 * Uso como componente:
 *   <bastet-jump duration="1200" jump-height="160" loop></bastet-jump>
 *   const cat = new BastetJump(contenedor, { autoPlay:false, duration:1200, jumpHeight:160, onJumpComplete(){} });
 *   cat.play();
 *
 * Opciones: autoPlay (true), loop (false), duration (1200 ms), jumpHeight (160 px),
 *           size (ancho en px, 96), playOnClick (true si autoPlay es false), onJumpComplete.
 * Respeta prefers-reduced-motion (no salta, muestra la pose de reposo).
 */
(function () {
  'use strict';

  var SPRITE = 'assets/bastet-sprites.webp', COLS = 8, CW = 284, CH = 371;
  var REST = 7, PREP = 0, CROUCH = 1, TAKEOFF = 2, ASCENT = 3, PEAK = 4, DESCENT = 5, LAND = 6; // índices 0-based de la hoja

  var easeOutCubic = function (p) { return 1 - Math.pow(1 - p, 3); };
  var easeInCubic = function (p) { return p * p * p; };
  var clamp01 = function (p) { return Math.max(0, Math.min(1, p)); };
  var reduced = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion:reduce)').matches; };

  /* Pose en el instante t (0..1) del salto: fotograma, elevación (0..1 de jumpHeight) y compresión vertical. */
  function poseAt(t) {
    t = clamp01(t);
    var frame = REST, y = 0, sy = 1, sx = 1;
    if (t < .10) { // preparación: se agacha
      var p = t / .10; frame = p < .45 ? PREP : CROUCH; sy = 1 - .08 * easeOutCubic(p); sx = 1 + .04 * p;
    } else if (t < .18) { // impulso
      frame = TAKEOFF; y = .18 * easeOutCubic((t - .10) / .08); sy = 1.06;
    } else if (t < .46) { // ascenso
      frame = ASCENT; y = .18 + .82 * easeOutCubic((t - .18) / .28); sy = 1.02;
    } else if (t < .56) { // punto máximo
      frame = PEAK; y = 1 + .02 * Math.sin(Math.PI * (t - .46) / .10);
    } else if (t < .80) { // descenso
      frame = DESCENT; y = 1 - easeInCubic((t - .56) / .24);
    } else if (t < .90) { // aterrizaje: amortigua
      var q = (t - .80) / .10; frame = LAND; sy = 1 - .12 * Math.sin(Math.PI * q); sx = 1 + .05 * Math.sin(Math.PI * q);
    } else { // recuperación
      frame = t < .95 ? PREP : REST; sy = 1 - .03 * (1 - (t - .90) / .10);
    }
    return { frame: frame, y: y, sy: sy, sx: sx };
  }

  /* Elemento sprite reutilizable: <div> con la hoja como fondo, cuadro 'i' visible. */
  function createSprite(width) {
    var el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'background:url(' + SPRITE + ') no-repeat;background-size:' + COLS * 100 + '% 100%;background-position:0 0;image-rendering:auto;pointer-events:none';
    el.setFrame = function (i) { el.style.backgroundPositionX = (i / (COLS - 1) * 100) + '%'; };
    el.setWidth = function (w) { el.style.width = w + 'px'; el.style.height = (w * CH / CW) + 'px'; };
    el.setWidth(width || 96); el.setFrame(REST);
    return el;
  }

  function BastetJump(host, opts) {
    opts = opts || {};
    var self = this;
    this.host = host;
    this.autoPlay = opts.autoPlay !== false;
    this.loop = !!opts.loop;
    this.duration = opts.duration > 0 ? opts.duration : 1200;
    this.jumpHeight = opts.jumpHeight != null ? opts.jumpHeight : 160;
    this.size = opts.size || 96;
    this.onJumpComplete = opts.onJumpComplete;
    this.playOnClick = opts.playOnClick != null ? opts.playOnClick : !this.autoPlay;
    this.playing = false; this.visible = true; this._raf = 0;

    var h = this.size * CH / CW;
    host.style.position = host.style.position || 'relative';
    host.style.display = host.style.display || 'inline-block';
    host.style.width = this.size + 'px'; host.style.height = h + 'px';
    host.style.pointerEvents = this.playOnClick ? 'auto' : 'none';
    if (this.playOnClick) host.style.cursor = 'pointer';

    this.shadow = document.createElement('div');
    this.shadow.setAttribute('aria-hidden', 'true');
    this.shadow.style.cssText = 'position:absolute;left:12%;right:12%;bottom:-2px;height:' + Math.max(6, this.size * .09) + 'px;border-radius:50%;background:radial-gradient(closest-side,rgba(60,40,5,.38),transparent);pointer-events:none;transform-origin:50% 50%';
    this.body = document.createElement('div');
    this.body.style.cssText = 'position:absolute;inset:0;transform-origin:50% 100%;will-change:transform;pointer-events:none';
    this.sprite = createSprite(this.size);
    this.sprite.style.animation = reduced() ? '' : 'bastetbreath 3.2s ease-in-out infinite';
    this.sprite.style.transformOrigin = '50% 100%';
    this.body.appendChild(this.sprite); host.appendChild(this.shadow); host.appendChild(this.body);
    if (!document.getElementById('bastet-kf')) {
      var st = document.createElement('style'); st.id = 'bastet-kf';
      st.textContent = '@keyframes bastetbreath{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.025)}}';
      document.head.appendChild(st);
    }
    this._render(0, true);

    if (this.playOnClick) host.addEventListener('click', function () { self.play(); });
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(function (es) { self.visible = es[0].isIntersecting; if (self.visible && self.autoPlay && !self.playing) self.play(); }, { threshold: .05 });
      this._io.observe(host);
    }
    if (this.autoPlay) this.play();
  }

  BastetJump.prototype._render = function (t, rest) {
    var p = rest ? { frame: REST, y: 0, sy: 1, sx: 1 } : poseAt(t), H = this.jumpHeight * p.y;
    this.sprite.setFrame(p.frame);
    this.body.style.transform = 'translate3d(0,' + (-H) + 'px,0) scale(' + p.sx + ',' + p.sy + ')';
    var k = 1 - Math.min(1, H / (this.jumpHeight * 1.3 || 1));
    this.shadow.style.transform = 'scale(' + (.45 + .55 * k) + ')';
    this.shadow.style.opacity = String(.25 + .75 * k);
  };

  BastetJump.prototype.play = function () {
    var self = this;
    if (this.playing) return;
    if (reduced()) { this._render(0, true); if (this.onJumpComplete) this.onJumpComplete(); return; }
    this.playing = true;
    var t0 = 0;
    var tick = function (now) {
      if (!t0) t0 = now;
      var t = (now - t0) / self.duration;
      if (t >= 1) {
        self._render(0, true); self.playing = false;
        if (self.onJumpComplete) self.onJumpComplete();
        if (self.loop && self.visible) self.play();
        return;
      }
      self._render(t);
      self._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  };

  BastetJump.prototype.stop = function () { cancelAnimationFrame(this._raf); this.playing = false; this._render(0, true); };
  BastetJump.prototype.destroy = function () { this.stop(); if (this._io) this._io.disconnect(); this.host.innerHTML = ''; };

  BastetJump.poseAt = poseAt;
  BastetJump.createSprite = createSprite;
  BastetJump.REST = REST;
  BastetJump.ASPECT = CH / CW;
  window.BastetJump = BastetJump;

  /* Custom element: <bastet-jump auto-play="false" loop duration="1200" jump-height="160" size="96"> */
  if (window.customElements && !customElements.get('bastet-jump')) {
    customElements.define('bastet-jump', class extends HTMLElement {
      connectedCallback() {
        var a = this.getAttribute.bind(this), bool = function (n, d) { var v = a(n); return v == null ? d : v !== 'false'; };
        this.cat = new BastetJump(this, {
          autoPlay: bool('auto-play', true), loop: this.hasAttribute('loop') && a('loop') !== 'false',
          duration: +a('duration') || 1200, jumpHeight: a('jump-height') != null ? +a('jump-height') : 160,
          size: +a('size') || 96, playOnClick: a('play-on-click') != null ? bool('play-on-click', true) : undefined,
          onJumpComplete: () => this.dispatchEvent(new CustomEvent('jumpcomplete'))
        });
      }
      disconnectedCallback() { if (this.cat) this.cat.destroy(); }
      play() { if (this.cat) this.cat.play(); }
    });
  }
})();
