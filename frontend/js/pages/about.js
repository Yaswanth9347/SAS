// About Page Script: handles contact form validation and submission

(function() {
	'use strict';

	function init() {
		const form = document.getElementById('aboutContactForm');
		if (!form) return;

		const nameInput = document.getElementById('aboutName');
		const emailInput = document.getElementById('aboutEmail');
		const subjectInput = document.getElementById('aboutSubject');
		const messageInput = document.getElementById('aboutMessage');
		const submitBtn = document.getElementById('aboutContactSubmit');
		const charCount = document.getElementById('aboutMessageCount');

		// Live character count for message
		const updateCharCount = () => {
			const len = (messageInput?.value || '').trim().length;
			if (charCount) {
				charCount.textContent = `${len} / 10 characters minimum`;
				charCount.style.color = len >= 10 ? '#2e7d32' : '#b00020';
			}
		};

		if (messageInput) {
			messageInput.addEventListener('input', updateCharCount);
			updateCharCount();
		}

		// Field-level validation helpers
		const setFieldState = (input, isValid, msg = '') => {
			if (!input) return;
			const group = input.closest('.form-group');
			const errorEl = group ? group.querySelector('.field-error') : null;

			input.classList.remove('invalid', 'valid');
			if (isValid) {
				input.classList.add('valid');
				if (errorEl) errorEl.style.display = 'none';
			} else {
				input.classList.add('invalid');
				if (errorEl) {
					if (msg) errorEl.textContent = msg;
					errorEl.style.display = 'block';
				}
			}
		};

		const validate = () => {
			let ok = true;

			const nameVal = (nameInput?.value || '').trim();
			if (nameInput) {
				const valid = nameVal.length >= 2;
				ok = ok && valid;
				setFieldState(nameInput, valid, 'Name must be at least 2 characters');
			}

			const emailVal = (emailInput?.value || '').trim();
			if (emailInput) {
				const valid = utils.isValidEmail(emailVal);
				ok = ok && valid;
				setFieldState(emailInput, valid, 'Please enter a valid email address');
			}

			const msgVal = (messageInput?.value || '').trim();
			if (messageInput) {
				const valid = msgVal.length >= 10;
				ok = ok && valid;
				setFieldState(messageInput, valid, 'Message must be at least 10 characters');
			}

			return ok;
		};

		// Real-time validation on blur
		[nameInput, emailInput, messageInput].forEach(inp => {
			if (!inp) return;
			inp.addEventListener('blur', validate);
			inp.addEventListener('input', () => {
				// Remove error state as user types
				if (inp.classList.contains('invalid')) validate();
			});
		});

			// Submit handler (Formspree)
		form.addEventListener('submit', async (e) => {
			e.preventDefault();

			if (!validate()) {
				if (typeof notify !== 'undefined') notify.error('Please fix the highlighted fields.');
				return;
			}

				// Build payload (Formspree expects names: email, message; extra fields allowed)
				const payload = {
					name: nameInput?.value.trim(),
					email: emailInput?.value.trim(),
					subject: subjectInput?.value.trim(),
					message: messageInput?.value.trim(),
					source: 'about'
				};

			try {
				// Button loading state
				if (typeof loading !== 'undefined') loading.showButtonLoading('aboutContactSubmit', 'Sending...');
				Array.from(form.elements).forEach(el => el.disabled = true);

					// Prefer AJAX to keep user on page and show nicer feedback
					const endpoint = form.getAttribute('action') || 'https://formspree.io/f/xnnoaeeq';
					const res = await fetch(endpoint, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'Accept': 'application/json'
						},
						body: JSON.stringify(payload)
					});

					if (!res.ok) {
						// If JSON error available, try to read it
						let msg = 'Failed to send message. Please try again.';
						try {
							const j = await res.json();
							if (j && j.errors && j.errors.length) msg = j.errors.map(e => e.message).join(', ');
						} catch(_) {/* ignore */}
						throw new Error(msg);
					}

				if (typeof notify !== 'undefined') notify.success('Thanks! Your message has been sent.');
				form.reset();
				[nameInput, emailInput, messageInput].forEach(inp => inp && inp.classList.remove('valid', 'invalid'));
				updateCharCount();
			} catch (err) {
					if (typeof notify !== 'undefined') notify.error(err?.message || 'Failed to send message. Please try again.');
					// Progressive enhancement fallback: try native submission if fetch failed
					try {
						form.submit();
					} catch(_) { /* no-op */ }
			} finally {
				if (typeof loading !== 'undefined') loading.hideButtonLoading('aboutContactSubmit');
				Array.from(form.elements).forEach(el => el.disabled = false);
			}
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();

