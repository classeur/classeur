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
			this.$jqElt = elt;
			this.$elt = elt[0];
		}

		Panel.prototype.css = function(attr, value) {
			this.$elt.style[attr] = value !== undefined ? value : '';
			return this;
		};

		function styleSetter(attr, unit) {
			return function(value) {
				this.$elt.style[attr] = value !== undefined ? value + unit : '';
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
		].forEach(function(attr) {
			Panel.prototype[attr] = styleSetter(attr, 'px');
		});

		var speedValues = {
			fast: 90,
			slow: 180,
			sslow: 270
		};
		Panel.prototype.move = function(speed) {
			var result = $window.move(this.$elt).ease('out');
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
			elt.on('mousedown', function(evt) {
				evt.preventDefault();
			});
			var panel = clPanel(elt, selector);
			panel.move().rotate(rotation)
				.then(function() {
					panel.move('slow').rotate(rotation).to(x, y).ease('ease-out-back').end();
				}).end();

			var hammertime = new Hammer(panel.$elt);
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
	.factory('clScrollBarWidth', function() {
		var scrollDiv = document.createElement("div");
		scrollDiv.style.width = '100px';
		scrollDiv.style.height = '100px';
		scrollDiv.style.overflow = 'scroll';
		scrollDiv.style.position = 'absolute';
		scrollDiv.style.top = '-9999px';
		document.body.appendChild(scrollDiv);
		var scrollBarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
		document.body.removeChild(scrollDiv);
		return scrollBarWidth;
	})
	.factory('clLocalStorageObject', function() {

		function LocalStorageObject(prefix, globalUpdate) {
			this.$globalPrefix = prefix ? prefix + '.' : '';
			this.$setId();
			if (globalUpdate) {
				var self = this; // Make sure we update the __proto__ object
				var globalUpdateKey = this.$globalPrefix + 'gu';
				this.$checkGlobalUpdate = function() {
					return self.gUpdated != localStorage[globalUpdateKey];
				};
				this.$readGlobalUpdate = function() {
					self.gUpdated = parseInt(localStorage[globalUpdateKey]);
					isNaN(self.gUpdated) && self.$setGlobalUpdate(Date.now());
				};
				this.$setGlobalUpdate = function(updated) {
					self.gUpdated = updated;
					localStorage[globalUpdateKey] = updated;
				};
				this.$readGlobalUpdate();
			}
		}

		LocalStorageObject.prototype.$setId = function(id) {
			this.$localPrefix = this.$globalPrefix + (id ? id + '.' : '');
			this.$updateKey = this.$localPrefix + 'u';
			this.$readUpdate();
		};

		LocalStorageObject.prototype.$readAttr = function(name, defaultValue, parser) {
			var exists = true;
			var key = this.$localPrefix + name;
			var value = localStorage[key];
			if (value === undefined) {
				exists = false;
				value = defaultValue;
			}
			this['$_' + name] = value;
			value = parser ? parser(value) : value;
			this[name] = value;
			return exists;
		};

		LocalStorageObject.prototype.$checkAttr = function(name, defaultValue) {
			var key = this.$localPrefix + name;
			var value = localStorage[key] || defaultValue;
			return value !== this['$_' + name];
		};

		LocalStorageObject.prototype.$writeAttr = function(name, serializer, updated) {
			var value = serializer ? serializer(this[name]) : (this[name] || '').toString();
			if ((updated !== undefined && updated != this.updated) || value !== this['$_' + name]) {
				var key = this.$localPrefix + name;
				if (!value) {
					localStorage.removeItem(key);
				} else {
					localStorage[key] = value;
				}
				this['$_' + name] = value;
				var currentDate = Date.now();
				this.$setUpdate(updated !== undefined ? updated : currentDate);
				this.$setGlobalUpdate && this.$setGlobalUpdate(currentDate);
				return true;
			}
		};

		LocalStorageObject.prototype.$freeAttr = function(name) {
			this[name] = undefined;
			this['$_' + name] = undefined;
		};

		LocalStorageObject.prototype.$checkUpdate = function() {
			return this.updated != (localStorage[this.$updateKey] || 0);
		};

		LocalStorageObject.prototype.$readUpdate = function() {
			this.updated = parseInt(localStorage[this.$updateKey]);
			if (isNaN(this.updated)) {
				this.updated = 0;
			}
		};

		LocalStorageObject.prototype.$setUpdate = function(updated) {
			this.updated = updated;
			if (!updated) {
				localStorage.removeItem(this.$updateKey);
			} else {
				localStorage[this.$updateKey] = updated;
			}
		};

		return function(prefix, globalUpdate) {
			return new LocalStorageObject(prefix, globalUpdate);
		};
	})
	.factory('clStateMgr', function($rootScope, $location, clUid) {
		var stateKeyPrefix = 'state.';
		var stateMaxAge = 3600000; // 1 hour

		var currentDate = Date.now();
		var keyPrefix = /^state\.(.+)/;
		Object.keys(localStorage).forEach(function(key) {
			var match = key.match(keyPrefix);
			if (match) {
				var stateAge = parseInt(match[1].split('.')[1] || 0);
				(currentDate - stateAge > stateMaxAge) && localStorage.removeItem(key);
			}
		});

		var clStateMgr = {
			saveState: function(state) {
				var stateId = clUid() + '.' + Date.now();
				localStorage[stateKeyPrefix + stateId] = JSON.stringify(state);
				return stateId;
			}
		};

		function checkState(stateId) {
			clStateMgr.state = undefined;
			if (stateId) {
				var storedState = localStorage[stateKeyPrefix + stateId];
				if (storedState) {
					localStorage.removeItem(stateKeyPrefix + stateId);
					clStateMgr.checkedState = JSON.parse(storedState);
					clStateMgr.checkedState.$search = $location.search();
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
	.factory('clSetInterval', function($window) {
		var lastFocus, lastFocusKey = 'lastWindowFocus';

		function setLastFocus() {
			lastFocus = Date.now();
			localStorage[lastFocusKey] = lastFocus;
		}

		function isWindowFocus() {
			return localStorage[lastFocusKey] == lastFocus;
		}

		setLastFocus();
		$window.addEventListener('focus', setLastFocus);
		return function(cb, interval, checkWindowFocus) {
			interval = (1 + (Math.random() - 0.5) * 0.1) * interval | 0;
			setInterval(function() {
				(!checkWindowFocus || isWindowFocus()) && cb();
			}, interval);
		};
	})
	.factory('clUrl', function() {
		return {
			file: function(fileDao, user) {
				var userId = fileDao.userId || (user && user.id) || '';
				if (fileDao.id) {
					return (userId && '/users/' + userId) + '/files/' + fileDao.id;
				} else if (fileDao.fileName) {
					return '/docs/' + fileDao.fileName;
				} else {
					return '';
				}
			},
			docFile: function(fileName) {
				return this.file({
					fileName: fileName
				});
			},
			folder: function(folderDao, user) {
				var userId = folderDao.userId || (user && user.id) || '';
				if (folderDao.id) {
					return (userId && '/users/' + userId) + '/folders/' + folderDao.id;
				} else {
					return '';
				}
			}
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
	})
	.directive('clInfiniteScroll', function($timeout) {
		return {
			restrict: 'A',
			link: function(scope, element, attr) {
				var elt = element[0];
				function trigger() {
					if(elt.scrollTop + elt.offsetHeight > elt.scrollHeight - 300) {
						scope.$eval(attr.clInfiniteScroll) && $timeout(trigger);
					}
				}
				elt.addEventListener('scroll', trigger);
				scope.triggerInfiniteScroll = function() {
					$timeout(trigger);
				};
			}
		};
	});
