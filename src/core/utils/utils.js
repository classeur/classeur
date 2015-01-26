angular.module('classeur.core.utils', [])
	.factory('clUid', function() {
		// Generates a 16 char length random id
		var alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
		var mapper = Array.apply(null, new Array(16));
		return function() {
			return mapper.map(function() {
				return alphabet[Math.random() * alphabet.length | 0];
			}).join('');
		};
	})
	.factory('clToast', function($mdToast) {
		return function(text) {
			$mdToast.show(
				$mdToast.simple()
					.content(text)
					.position('bottom right')
					.hideDelay(6000)
			);
		};
	})
	.factory('clPanel', function() {
		window.move.defaults = {
			duration: 0
		};

		function Panel(elt, selector) {
			elt = selector ? angular.element(elt[0].querySelector(selector)) : elt;
			this.$elt = elt;
			this.$$elt = elt[0];
		}

		Panel.prototype.css = function(attr, value) {
			this.$$elt.style[attr] = value !== undefined ? value: '';
			return this;
		};

		function styleSetter(attr, unit) {
			return function(value) {
				this.$$elt.style[attr] = value !== undefined ? value + unit : '';
				return this;
			};
		}

		[
			'width',
			'height',
			'top',
			'right',
			'bottom',
			'marginTop',
			'marginRight',
			'marginBottom',
			'marginLeft',
			'left'
		].forEach(function(attr) {
				Panel.prototype[attr] = styleSetter(attr, 'px');
			});

		Panel.prototype.move = function() {
			return window.move(this.$$elt).ease('out');
		};

		return function(elt, selector) {
			return new Panel(elt, selector);
		};
	})
	.factory('clDraggablePanel', function(clPanel) {
		var Hammer = window.Hammer;
		return function(elt, selector, x, y, rotation) {
			rotation = rotation || 0;
			var panel = clPanel(elt, selector);
			panel.move().rotate(rotation)
				.then().to(x, y).duration(180).ease('ease-out-back').pop()
				.end();

			var hammertime = new Hammer(panel.$$elt);
			hammertime.get('pan').set({ direction: Hammer.DIRECTION_ALL, threshold: 0 });
			hammertime.on('panmove', function(evt) {
				evt.preventDefault();
				panel.move().rotate(rotation).to(x + evt.deltaX, y + evt.deltaY).end();
			});
			hammertime.on('panend', function(evt) {
				x += evt.deltaX;
				y += evt.deltaY;
			});
			return panel;
		};
	})
	.factory('clLocalStorageObject', function() {
		var appPrefix = 'cl.';
		var lastModificationKey = appPrefix + 'lastStorageModification';

		function LocalStorageObject(prefix) {
			this.$prefix = prefix ? appPrefix + prefix + '.' : appPrefix;
		}

		LocalStorageObject.prototype.$readAttr = function(name, defaultValue, processor) {
			var key = this.$prefix + (this.id ? this.id + '.' : '') + name;
			var value = localStorage[key] || defaultValue;
			this['$' + name + 'Saved'] = value;
			value = processor ? processor(value) : value;
			this[name] = value;
		};

		LocalStorageObject.prototype.$checkAttr = function(name, defaultValue) {
			var key = this.$prefix + (this.id ? this.id + '.' : '') + name;
			var value = localStorage[key] || defaultValue;
			if(value !== this['$' + name + 'Saved']) {
				return true;
			}
		};

		LocalStorageObject.prototype.$writeAttr = function(name, processor) {
			var value = processor ? processor(this[name]) : this[name];
			if(value !== this['$' + name + 'Saved']) {
				var key = this.$prefix + (this.id ? this.id + '.' : '') + name;
				localStorage[key] = value;
				this['$' + name + 'Saved'] = value;
				localStorage[lastModificationKey] = Date.now();
				return true;
			}
		};

		LocalStorageObject.prototype.$freeAttr = function(name) {
			delete this[name];
			delete this['$' + name + 'Saved'];
		};

		return function(prefix) {
			return new LocalStorageObject(prefix);
		};
	})
	.factory('clSelectionListeningSvc', function($timeout) {
		var clSelectionListeningSvc = {};

		function saveSelection() {
			$timeout(function() {
				var selection = window.getSelection();
				clSelectionListeningSvc.range = selection.rangeCount && selection.getRangeAt(0);
			}, 25);
		}

		window.addEventListener('keyup', saveSelection);
		window.addEventListener('mouseup', saveSelection);
		window.addEventListener('contextmenu', saveSelection);
		return clSelectionListeningSvc;
	})
	.factory('clUriValidator', function() {
		var aHrefSanitizationWhitelist = /^\s*(https?|ftp|mailto|tel|file):/,
			imgSrcSanitizationWhitelist = /^\s*(https?|ftp|file):|data:image\//;

		var msie = window.cledit.Utils.isMsie;

		var urlParsingNode = document.createElement("a");

		function urlResolve(url) {
			var href = url;

			if(msie) {
				// Normalize before parse.  Refer Implementation Notes on why this is
				// done in two steps on IE.
				urlParsingNode.setAttribute("href", href);
				href = urlParsingNode.href;
			}

			urlParsingNode.setAttribute('href', href);

			// urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
			return {
				href: urlParsingNode.href,
				protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
				host: urlParsingNode.host,
				search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
				hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
				hostname: urlParsingNode.hostname,
				port: urlParsingNode.port,
				pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
					urlParsingNode.pathname : '/' + urlParsingNode.pathname
			};
		}

		return function(uri, isImage) {
			var regex = isImage ? imgSrcSanitizationWhitelist : aHrefSanitizationWhitelist;
			var normalizedVal;
			normalizedVal = urlResolve(uri).href;
			if(normalizedVal === '' || normalizedVal.match(regex)) {
				return true;
			}
		};
	});
