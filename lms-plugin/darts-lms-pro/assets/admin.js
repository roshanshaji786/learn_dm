/* Darts LMS Pro — admin */
(function () {
	'use strict';
	// Show only the drip fields that apply.
	function syncDrip(sel) {
		var fs = sel.closest('fieldset');
		fs.querySelectorAll('[data-show]').forEach(function (el) {
			el.style.display = el.getAttribute('data-show') === sel.value ? '' : 'none';
		});
	}
	document.querySelectorAll('[data-dlms-toggle]').forEach(function (sel) {
		syncDrip(sel);
		sel.addEventListener('change', function () { syncDrip(sel); });
	});

	// Prefill the course fee on the enrol form.
	var fees = window.DLMS_FEES || {};
	var csel = document.querySelector('select[name="course_id"]');
	var fee = document.querySelector('[data-dlms-fee]');
	if (csel && fee) {
		csel.addEventListener('change', function () {
			if (fees[csel.value] !== undefined && (!fee.value || fee.dataset.auto)) {
				fee.value = fees[csel.value];
				fee.dataset.auto = '1';
			}
		});
		fee.addEventListener('input', function () { delete fee.dataset.auto; });
	}

	// Media picker for the logo.
	document.querySelectorAll('[data-dlms-media]').forEach(function (b) {
		b.addEventListener('click', function (e) {
			e.preventDefault();
			if (!window.wp || !wp.media) { return; }
			var f = wp.media({ title: 'Choose logo', multiple: false, library: { type: 'image' } });
			f.on('select', function () {
				var a = f.state().get('selection').first().toJSON();
				document.querySelector(b.getAttribute('data-dlms-media')).value = a.url;
			});
			f.open();
		});
	});

	// WhatsApp: template switcher and audience picker.
	var tpl = document.querySelector('[data-dlms-tpl]');
	var msg = document.querySelector('[data-dlms-msg]');
	if (tpl && msg) {
		tpl.addEventListener('change', function () {
			var t = (window.DLMS_WA_TPL || {})[tpl.value];
			if (t !== undefined) { msg.value = t; msg.focus(); }
		});
	}
	var aud = document.querySelector('[data-dlms-aud]');
	if (aud) {
		var syncAud = function () {
			document.querySelectorAll('[data-aud-show]').forEach(function (el) {
				el.style.display = el.getAttribute('data-aud-show') === aud.value ? '' : 'none';
			});
		};
		syncAud();
		aud.addEventListener('change', syncAud);
	}

	// WhatsApp: the tap queue.
	var table = document.querySelector('.dlms-wa-table');
	if (table) {
		var nonce = table.getAttribute('data-nonce');
		var setRow = function (tr, status) {
			tr.setAttribute('data-status', status);
			var pill = tr.querySelector('.dlms-wa-st .dlms-pill');
			if (pill) { pill.className = 'dlms-pill dlms-wa-' + status; pill.textContent = status; }
			tr.querySelectorAll('[data-dlms-open]').forEach(function (a) { a.classList.remove('button-primary'); });
			var sk = tr.querySelector('[data-dlms-skip]');
			if (sk) { sk.remove(); }
			var top = document.querySelector('.dlms-wa-top strong');
			if (top) {
				var all = table.querySelectorAll('tbody tr').length;
				var done = table.querySelectorAll('tbody tr[data-status="sent"],tbody tr[data-status="skipped"]').length;
				top.textContent = done + ' / ' + all;
			}
		};
		var mark = function (tr, status) {
			var body = new URLSearchParams({ action: 'dlms_wa_mark', id: tr.getAttribute('data-id'), status: status, _ajax_nonce: nonce });
			return fetch(window.ajaxurl || '/wp-admin/admin-ajax.php', { method: 'POST', credentials: 'same-origin', body: body })
				.then(function (r) { return r.json(); })
				.then(function (j) { if (j && j.success) { setRow(tr, j.data.status); } });
		};
		table.addEventListener('click', function (e) {
			var tr = e.target.closest('tr[data-id]');
			if (!tr) { return; }
			if (e.target.closest('[data-dlms-open]')) {
				mark(tr, 'sent');
			} else if (e.target.closest('[data-dlms-skip]')) {
				e.preventDefault();
				mark(tr, 'skipped');
			} else if (e.target.closest('[data-dlms-copy]')) {
				e.preventDefault();
				var b = e.target.closest('[data-dlms-copy]');
				var txt = b.getAttribute('data-dlms-copy');
				var done = function () { var o = b.textContent; b.textContent = 'Copied ✓'; setTimeout(function () { b.textContent = o; }, 1500); };
				if (navigator.clipboard) { navigator.clipboard.writeText(txt).then(done); } else {
					var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done();
				}
			}
		});
		var next = document.querySelector('[data-dlms-next]');
		if (next) {
			next.addEventListener('click', function () {
				var tr = table.querySelector('tbody tr[data-status="pending"]');
				var a = tr && tr.querySelector('[data-dlms-open]');
				if (!a) { next.textContent = 'All done ✓'; next.disabled = true; return; }
				window.open(a.href, '_blank', 'noopener');
				mark(tr, 'sent');
				tr.scrollIntoView({ block: 'center', behavior: 'smooth' });
			});
		}
	}
})();
