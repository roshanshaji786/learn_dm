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
})();
