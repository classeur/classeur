angular.module('classeur.core.utils', [])
	.factory('clUid', function() {
		var alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
		var radix = alphabet.length;
		var length = 16;
		var mapper = Array.apply(null, new Array(length));

		function clUid() {
			return mapper.map(function() {
				return alphabet[Math.random() * radix | 0];
			}).join('');
		}
		return clUid;
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
	.factory('clPanel', function($window) {
		$window.move.defaults = {
			duration: 0
		};

		function Panel(elt, selector) {
			elt = selector ? angular.element(elt[0].querySelector(selector)) : elt;
			this.$elt = elt;
			this.$$elt = elt[0];
		}

		Panel.prototype.css = function(attr, value) {
			this.$$elt.style[attr] = value !== undefined ? value : '';
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
			'left',
			'marginTop',
			'marginRight',
			'marginBottom',
			'marginLeft'
		].forEach(function(attr) {
			Panel.prototype[attr] = styleSetter(attr, 'px');
		});

		var speedValues = {
			fast: 90,
			slow: 180,
			sslow: 270
		};
		Panel.prototype.move = function(speed) {
			var result = $window.move(this.$$elt).ease('out');
			var duration = speedValues[speed];
			duration && result.duration(duration);
			return result;
		};

		return function(elt, selector) {
			return new Panel(elt, selector);
		};
	})
	.factory('clDraggablePanel', function($window, clPanel) {
		var Hammer = $window.Hammer;
		return function(elt, selector, x, y, rotation) {
			rotation = rotation || 0;
			var panel = clPanel(elt, selector);
			panel.move().rotate(rotation)
				.then(function() {
					panel.move('slow').to(x, y).ease('ease-out-back').end();
				}).end();

			var hammertime = new Hammer(panel.$$elt);
			hammertime.get('pan').set({
				direction: Hammer.DIRECTION_ALL,
				threshold: 0
			});
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

		function LocalStorageObject(prefix) {
			this.$globalPrefix = prefix ? prefix + '.' : '';
			this.$globalUpdateKey = this.$globalPrefix + 'u';
			this.$setId();
			var self = this; // Make sure we update the __proto__ object
			this.$readGlobalUpdate = function() {
				self.gUpdated = parseInt(localStorage[this.$globalUpdateKey]);
				isNaN(self.gUpdated) && this.$setGlobalUpdate(Date.now());
			};
			this.$setGlobalUpdate = function(updated) {
				self.gUpdated = updated;
				localStorage[this.$globalUpdateKey] = updated;
			};
			this.$readGlobalUpdate();
		}

		LocalStorageObject.prototype.$setId = function(id) {
			this.$localPrefix = this.$globalPrefix + (id ? id + '.' : '');
			this.$localUpdateKey = this.$localPrefix + 'u';
			this.$readLocalUpdate();
		};

		LocalStorageObject.prototype.$readAttr = function(name, defaultValue, parser) {
			var exists = true;
			var key = this.$localPrefix + name;
			var value = localStorage[key];
			if (value === undefined) {
				exists = false;
				value = defaultValue;
			}
			this['$' + name + 'Saved'] = value;
			value = parser ? parser(value) : value;
			this[name] = value;
			return exists;
		};

		LocalStorageObject.prototype.$checkAttr = function(name, defaultValue) {
			var key = this.$localPrefix + name;
			var value = localStorage[key] || defaultValue;
			return value !== this['$' + name + 'Saved'];
		};

		LocalStorageObject.prototype.$writeAttr = function(name, serializer, updated) {
			var value = serializer ? serializer(this[name]) : (this[name] || '').toString();
			if ((updated !== undefined && updated != this.updated) || value !== this['$' + name + 'Saved']) {
				var key = this.$localPrefix + name;
				if (!value) {
					localStorage.removeItem(key);
				} else {
					localStorage[key] = value;
				}
				this['$' + name + 'Saved'] = value;
				var currentDate = Date.now();
				this.$setLocalUpdate(updated !== undefined ? updated : currentDate);
				this.$setGlobalUpdate(currentDate);
				return true;
			}
		};

		LocalStorageObject.prototype.$freeAttr = function(name) {
			this[name] = undefined;
			this['$' + name + 'Saved'] = undefined;
		};

		LocalStorageObject.prototype.$checkLocalUpdate = function() {
			return this.updated != (localStorage[this.$localUpdateKey] || 0);
		};

		LocalStorageObject.prototype.$readLocalUpdate = function() {
			this.updated = parseInt(localStorage[this.$localUpdateKey]);
			if(isNaN(this.updated)) {
				this.updated = 0;
			}
		};

		LocalStorageObject.prototype.$setLocalUpdate = function(updated) {
			this.updated = updated;
			if (!updated) {
				localStorage.removeItem(this.$localUpdateKey);
			} else {
				localStorage[this.$localUpdateKey] = updated;
			}
		};

		LocalStorageObject.prototype.$checkGlobalUpdate = function() {
			return this.gUpdated != localStorage[this.$globalUpdateKey];
		};

		return function(prefix) {
			return new LocalStorageObject(prefix);
		};
	})
	.factory('clStateMgr', function($rootScope, clUid) {
		var stateKeyPrefix = 'state.';
		var stateMaxAge = 3600000; // 1 hour

		var currentDate = Date.now();
		var keyPrefix = /^cl\.state\.(.+)/;
		for (var key in localStorage) {
			var match = key.match(keyPrefix);
			if (match) {
				var stateAge = parseInt(match[1].split('.')[1] || 0);
				(currentDate - stateAge > stateMaxAge) && localStorage.removeItem(key);
			}
		}

		var clStateMgr = {
			saveState: function(state) {
				var stateId = clUid() + '.' + Date.now();
				localStorage[stateKeyPrefix + stateId] = JSON.stringify(state);
				return stateId;
			}
		};

		function checkState(stateId) {
			if (stateId) {
				var storedState = localStorage[stateKeyPrefix + stateId];
				if (storedState) {
					localStorage.removeItem(stateKeyPrefix + stateId);
					clStateMgr.checkedState = JSON.parse(storedState);
				}
			} else {
				clStateMgr.state = clStateMgr.checkedState;
				clStateMgr.checkedState = undefined;
			}
		}

		$rootScope.$on('$routeChangeStart', function(evt, next) {
			checkState(next.params.stateId);
		});

		return clStateMgr;
	})
	.factory('clSelectionListeningSvc', function($window, $timeout) {
		var clSelectionListeningSvc = {};

		function saveSelection() {
			$timeout(function() {
				var selection = $window.getSelection();
				clSelectionListeningSvc.range = selection.rangeCount && selection.getRangeAt(0);
			}, 25);
		}

		$window.addEventListener('keyup', saveSelection);
		$window.addEventListener('mouseup', saveSelection);
		$window.addEventListener('contextmenu', saveSelection);
		return clSelectionListeningSvc;
	})
	.factory('clSetInterval', function($window, clSocketSvc) {
		var lastFocus, lastFocusKey = 'lastWindowFocus';
		function setLastFocus() {
			lastFocus = Date.now();
			localStorage[lastFocusKey] = lastFocus;
		}
		setLastFocus();
		$window.addEventListener('focus', setLastFocus);
		return function(cb, interval, checkConnectionStatus, checkWindowFocus) {
			interval = (1 + (Math.random() - 0.5) * 0.1) * interval | 0;
			setInterval(function() {
				(!checkConnectionStatus || clSocketSvc.isReady) && (!checkWindowFocus || localStorage[lastFocusKey] == lastFocus) && cb();
			}, interval);
		};
	})
	.factory('clUriValidator', function($window) {
		var aHrefSanitizationWhitelist = /^\s*(https?|ftp|mailto|tel|file):/,
			imgSrcSanitizationWhitelist = /^\s*(https?|ftp|file):|data:image\//;

		var msie = $window.cledit.Utils.isMsie;

		var urlParsingNode = $window.document.createElement("a");

		function urlResolve(url) {
			var href = url;

			if (msie) {
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
			if (normalizedVal === '' || normalizedVal.match(regex)) {
				return true;
			}
		};
	});
