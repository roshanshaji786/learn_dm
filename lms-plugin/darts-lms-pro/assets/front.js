/* Darts LMS Pro — front end */
(function () {
	'use strict';

	// Countdown to live class + auto-refresh when Join opens.
	function pad(n) { return n < 10 ? '0' + n : '' + n; }
	var cds = document.querySelectorAll('.dlms-countdown[data-to]');
	if (cds.length) {
		var tick = function () {
			var now = Math.floor(Date.now() / 1000);
			cds.forEach(function (el) {
				var box = el.closest('.dlms-live');
				var open = box ? parseInt(box.getAttribute('data-open'), 10) : 0;
				if (open && now >= open) { location.reload(); return; }
				var s = Math.max(0, parseInt(el.getAttribute('data-to'), 10) - now);
				var d = Math.floor(s / 86400); s -= d * 86400;
				var h = Math.floor(s / 3600); s -= h * 3600;
				var m = Math.floor(s / 60); s -= m * 60;
				el.textContent = (d ? d + 'd ' : '') + pad(h) + ':' + pad(m) + ':' + pad(s);
			});
		};
		tick();
		setInterval(tick, 1000);
	}

	// Content protection + moving watermark.
	var cfg = window.DLMS_PROTECT;
	if (cfg) {
		document.addEventListener('contextmenu', function (e) {
			if (e.target.closest('input,textarea,[contenteditable]')) { return; }
			e.preventDefault();
		});
		document.addEventListener('keydown', function (e) {
			var k = (e.key || '').toLowerCase();
			if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'u' || k === 'p' || (e.shiftKey && (k === 'i' || k === 'j' || k === 'c')))) { e.preventDefault(); }
		});
		document.addEventListener('dragstart', function (e) { if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') { e.preventDefault(); } });

		if (cfg.watermark) {
			var stamp = function () {
				var hosts = document.querySelectorAll('.dlms-video, .tutor-video-player, .tutor-video-player-wrapper, .plyr, video');
				hosts.forEach(function (h) {
					if (h.tagName === 'VIDEO') { h = h.parentElement; }
					if (!h || h.querySelector(':scope > .dlms-wm')) { return; }
					h.classList.add('dlms-wm-host');
					var w = document.createElement('div');
					w.className = 'dlms-wm';
					w.textContent = cfg.watermark;
					h.appendChild(w);
					var move = function () {
						w.style.top = (8 + Math.random() * 78) + '%';
						w.style.left = (4 + Math.random() * 60) + '%';
					};
					move();
					setInterval(move, 7000);
				});
			};
			stamp();
			setTimeout(stamp, 1500);
			setTimeout(stamp, 4000);
		}
	}

	// "Install app" button.
	var btn = document.querySelector('.dlms-install');
	var deferred = null;
	window.addEventListener('beforeinstallprompt', function (e) {
		e.preventDefault();
		deferred = e;
		try { if (localStorage.getItem('dlms_install_dismissed')) { return; } } catch (x) {}
		if (btn) { btn.hidden = false; }
	});
	if (btn) {
		btn.addEventListener('click', function () {
			btn.hidden = true;
			try { localStorage.setItem('dlms_install_dismissed', '1'); } catch (x) {}
			if (deferred) { deferred.prompt(); deferred = null; }
		});
	}
})();
