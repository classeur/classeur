angular.module('classeur.core.utils', [])
	.factory('clConfig',
		function($window) {
			return $window.CL_CONFIG || {};
		})
	.factory('clVersion',
		function($window) {
			var clVersion = $window.CL_VERSION || {};
			clVersion.getAssetPath = function(file) {
				return clVersion.classeur ? clVersion.classeur + '/' + file : file;
			};
			return clVersion;
		})
	.factory('clLocalStorage',
		function() {
			var version = parseInt(localStorage.getItem('version'));
			if (isNaN(version)) {
				version = 1;
			}
			localStorage.setItem('version', version);
			return localStorage;
		})
	.factory('clSetInterval',
		function() {
			return function(cb, interval) {
				interval = (1 + (Math.random() - 0.5) * 0.1) * interval | 0;
				setInterval(cb, interval);
			};
		})
	.factory('clUid',
		function() {
			var alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
			var radix = alphabet.length;
			var length = 20;
			var mapper = Array.apply(null, new Array(length));

			function clUid() {
				var currentDate = Date.now();
				return mapper.cl_map(function() {
					var result = alphabet[(currentDate + Math.random() * radix) % radix | 0];
					currentDate = Math.floor(currentDate / radix);
					return result;
				}).join('');
			}
			return clUid;
		})
	.factory('clHash',
		function() {
			return function(str) {
				var i = 0,
					hash = 0,
					c;
				if (str.length === 0) return hash;
				for (; i < str.length; i++) {
					c = str.charCodeAt(i);
					hash = ((hash << 5) - hash) + c;
				}
				return hash;
			};
		})
	.factory('clIsNavigatorOnline',
		function($window) {
			return function() {
				return $window.navigator.onLine !== false;
			};
		})
	.filter('clTimeSince',
		function() {
			var time_formats = [
				[60 * 2, '1 minute ago', '1 minute from now'],
				[60 * 60, 'minutes', 60],
				[60 * 60 * 2, '1 hour ago', '1 hour from now'],
				[60 * 60 * 24, 'hours', 60 * 60],
				[60 * 60 * 24 * 2, 'Yesterday', 'Tomorrow'],
				[60 * 60 * 24 * 7, 'days', 60 * 60 * 24],
				[60 * 60 * 24 * 7 * 4 * 2, 'Last week', 'Next week'],
				[60 * 60 * 24 * 7 * 4, 'weeks', 60 * 60 * 24 * 7],
				[60 * 60 * 24 * 7 * 4 * 2, 'Last month', 'Next month'],
				[60 * 60 * 24 * 7 * 4 * 12, 'months', 60 * 60 * 24 * 7 * 4],
				[60 * 60 * 24 * 7 * 4 * 12 * 2, 'Last year', 'Next year'],
				[60 * 60 * 24 * 7 * 4 * 12 * 100, 'years', 60 * 60 * 24 * 7 * 4 * 12],
				[60 * 60 * 24 * 7 * 4 * 12 * 100 * 2, 'Last century', 'Next century'],
				[60 * 60 * 24 * 7 * 4 * 12 * 100 * 20, 'centuries', 60 * 60 * 24 * 7 * 4 * 12 * 100]
			];
			return function(time) {
				var seconds = (+new Date() - time) / 1000,
					token = 'ago',
					list_choice = 1;

				if (seconds > -60 && seconds < 60) {
					return 'Just now';
				}
				if (seconds < 0) {
					seconds = Math.abs(seconds);
					token = 'from now';
					list_choice = 2;
				}
				var i = 0,
					format;
				while ((format = time_formats[i++]))
					if (seconds < format[0]) {
						if (typeof format[2] == 'string')
							return format[list_choice];
						else
							return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
					}
				return time;
			};
		})
	.factory('clDialog',
		function($window, $rootScope, $q, $mdDialog) {
			var mdDialogShow = $mdDialog.show;
			$rootScope.isDialogOpen = 0;
			$mdDialog.show = function(optionsOrPreset) {
				if ($window.event && $window.event.type === 'click') {
					optionsOrPreset.targetEvent = $window.event;
				}
				$rootScope.isDialogOpen++;

				function close() {
					$rootScope.isDialogOpen--;
				}
				return mdDialogShow.call($mdDialog, optionsOrPreset)
					.then(function(res) {
						close();
						return res;
					}, function(err) {
						close();
						return $q.reject(err);
					});
			};
			return $mdDialog;
		})
	.factory('clToast',
		function($window, $mdToast) {
			var toastShown, hideDelay = 6000;
			var resetFlag = $window.cledit.Utils.debounce(function() {
				toastShown = false;
			}, 500);
			var result = function(text, action) {
				if (toastShown) {
					return;
				}
				var toast = $mdToast.simple()
					.content(text)
					.action(action)
					.position('bottom right')
					.hideDelay(hideDelay);
				toastShown = true;
				resetFlag();
				return $mdToast.show(toast);
			};
			result.hideDelay = hideDelay;
			return result;
		})
	.factory('clLocalStorageObject',
		function(clLocalStorage) {

			function defaultParser(val) {
				return val;
			}

			function defaultSerializer(val) {
				return val.toString();
			}

			function simpleObjectSerializer(obj) {
				return JSON.stringify(Object.keys(obj).sort().cl_reduce(function(result, key) {
					return (result[key] = obj[key]), result;
				}, {}), function(key, value) {
					return key[0] === '$' ? undefined : value;
				});
			}

			function LocalStorageObject(prefix, attrs, globalUpdate) {
				this.$attrHelpers = attrs.cl_reduce(function($attrHelpers, value, key) {
					var sKey = '$_' + key;
					var defaultValue = value.default === undefined ? '' : value.default;
					var serializer = value.serializer || defaultSerializer;
					var parser = value.parser || defaultParser;
					if (value === 'int') {
						defaultValue = '0';
						parser = parseInt;
					} else if (value === 'object' || value === 'array') {
						defaultValue = value === 'object' ? '{}' : '[]';
						parser = JSON.parse;
						serializer = JSON.stringify;
					}
					/*jshint multistr: true, evil: true */
					var sValueChecker = new Function('serializer', 'cb', '\
						return function() {\
							var sValue = serializer(this.' + key + ');\
							return sValue !== this.' + sKey + ' && cb.call(this, sValue);\
						};\
					');
					if (value === 'string' || value === 'int') {
						sValueChecker = new Function('serializer', 'cb', '\
							return function() {\
								var sValue = this.' + key + ';\
								return sValue != this.' + sKey + ' && cb.call(this, serializer(sValue));\
							};\
						');
					}
					/*jshint multistr: false, evil: false */
					$attrHelpers[key] = {
						read: function() {
							var exists = true;
							var lsKey = this.$localPrefix + key;
							var sValue = clLocalStorage.getItem(lsKey);
							if (!sValue) {
								sValue = defaultValue;
								exists = false;
							}
							this[sKey] = sValue;
							this[key] = parser(sValue);
							return exists;
						},
						write: sValueChecker(serializer, function(sValue) {
							this[sKey] = sValue;
							var lsKey = this.$localPrefix + key;
							if (!sValue || sValue === defaultValue) {
								clLocalStorage.removeItem(lsKey);
							} else {
								clLocalStorage.setItem(lsKey, sValue);
							}
							var currentDate = Date.now();
							this.$writeUpdate(currentDate);
							this.$writeGlobalUpdate && this.$writeGlobalUpdate(currentDate);
							return true;
						}),
						check: function() {
							var lsKey = this.$localPrefix + key;
							var sValue = clLocalStorage.getItem(lsKey) || defaultValue;
							return sValue !== this[sKey];
						},
						free: function() {
							this[sKey] = undefined;
							this[key] = undefined;
						}

					};
					return $attrHelpers;
				}, {});

				this.$globalPrefix = prefix ? prefix + '.' : '';
				this.$setId();
				if (globalUpdate) {
					var self = this; // Make sure we update the __proto__ object
					var globalUpdateKey = this.$globalPrefix + 'gu';
					this.$checkGlobalUpdate = function() {
						return self.gUpdated != clLocalStorage[globalUpdateKey];
					};
					this.$readGlobalUpdate = function() {
						self.gUpdated = parseInt(clLocalStorage[globalUpdateKey]);
						isNaN(self.gUpdated) && self.$writeGlobalUpdate(Date.now());
					};
					this.$writeGlobalUpdate = function(updated) {
						self.gUpdated = updated;
						clLocalStorage[globalUpdateKey] = updated;
					};
					this.$readGlobalUpdate();
				}
			}

			LocalStorageObject.prototype.$setId = function(id) {
				var self = this;
				self.$localPrefix = self.$globalPrefix + (id ? id + '.' : '');
				self.$updateKey = self.$localPrefix + 'u';
				self.$readUpdate();

				function attrOperation(operation) {
					var attrHelperCalls = Object.keys(self.$attrHelpers).cl_map(function(key) {
						return 'this.$attrHelpers.' + key + '.' + operation + '.call(this)';
					});
					/*jshint evil: true */
					return new Function('return ' + attrHelperCalls.join('|'));
					/*jshint evil: false */
				}
				self.$read = attrOperation('read');
				self.$write = attrOperation('write');
				self.$check = attrOperation('check');
				self.$free = attrOperation('free');
				self.$attrHelpers.cl_each(function(helpers, key) {
					self.$read[key] = helpers.read.cl_bind(self);
					self.$write[key] = helpers.write.cl_bind(self);
					self.$check[key] = helpers.check.cl_bind(self);
					self.$free[key] = helpers.free.cl_bind(self);
				});
			};

			LocalStorageObject.prototype.$checkUpdate = function() {
				return this.updated != (clLocalStorage[this.$updateKey] || 0);
			};

			LocalStorageObject.prototype.$readUpdate = function() {
				this.updated = parseInt(clLocalStorage[this.$updateKey]);
				if (isNaN(this.updated)) {
					this.updated = 0;
				}
			};

			LocalStorageObject.prototype.$writeUpdate = function(updated) {
				this.updated = updated;
				if (!updated) {
					clLocalStorage.removeItem(this.$updateKey);
				} else {
					clLocalStorage[this.$updateKey] = updated;
				}
			};

			var clLocalStorageObject = function(prefix, attrs, globalUpdate) {
				return new LocalStorageObject(prefix, attrs, globalUpdate);
			};
			clLocalStorageObject.simpleObjectSerializer = simpleObjectSerializer;
			clLocalStorageObject.simpleObjectParser = JSON.parse;
			return clLocalStorageObject;
		})
	.factory('clStateMgr',
		function($rootScope, $location, clLocalStorage, clUid) {
			var stateKeyPrefix = 'state.';
			var stateMaxAge = 3600000; // 1 hour

			var currentDate = Date.now();
			var keyPrefix = /^state\.(.+)/;
			Object.keys(clLocalStorage).cl_each(function(key) {
				if (key.charCodeAt(0) === 0x73 /* s */ ) {
					var match = key.match(keyPrefix);
					if (match) {
						var stateAge = parseInt(match[1].split('.')[1] || 0);
						(currentDate - stateAge > stateMaxAge) && clLocalStorage.removeItem(key);
					}
				}
			});

			var clStateMgr = {
				saveState: function(state) {
					var stateId = clUid() + '.' + Date.now();
					clLocalStorage[stateKeyPrefix + stateId] = JSON.stringify(state);
					return stateId;
				}
			};

			function checkState(stateId) {
				clStateMgr.state = undefined;
				if (stateId) {
					var storedState = clLocalStorage[stateKeyPrefix + stateId];
					if (storedState) {
						clLocalStorage.removeItem(stateKeyPrefix + stateId);
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
	.factory('clUrl',
		function() {
			return {
				file: function(fileDao) {
					if (fileDao.id) {
						return '/files/' + fileDao.id;
					} else {
						return '';
					}
				},
				docFile: function(fileName) {
					return this.file({
						fileName: fileName
					});
				},
				folder: function(folderDao) {
					if (folderDao.id) {
						return '/folders/' + folderDao.id;
					} else {
						return '';
					}
				}
			};
		})
	.factory('clUrlSanitizer',
		function() {
			return function(url, addSlash) {
				if (!url) {
					return url;
				}
				if (url.indexOf('http') !== 0) {
					url = 'http://' + url;
				}
				if (addSlash && url.indexOf('/', url.length - 1) === -1) {
					url += '/';
				}
				return url;
			};
		})
	.factory('clRangeWrapper',
		function($window) {
			return {
				wrap: function(range, eltProperties) {
					var rangeLength = ('' + range).length;
					var wrappedLength = 0;
					var treeWalker = $window.document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
					var startOffset = range.startOffset;
					treeWalker.currentNode = range.startContainer;
					if (treeWalker.currentNode.nodeType === Node.TEXT_NODE || treeWalker.nextNode()) {
						do {
							if (treeWalker.currentNode.nodeValue !== '\n') {
								if (treeWalker.currentNode === range.endContainer && range.endOffset < treeWalker.currentNode.nodeValue.length) {
									treeWalker.currentNode.splitText(range.endOffset);
								}
								if (startOffset) {
									treeWalker.currentNode = treeWalker.currentNode.splitText(startOffset);
									startOffset = 0;
								}
								var elt = $window.document.createElement('span');
								for (var key in eltProperties) {
									elt[key] = eltProperties[key];
								}
								treeWalker.currentNode.parentNode.insertBefore(elt, treeWalker.currentNode);
								elt.appendChild(treeWalker.currentNode);
							}
							wrappedLength += treeWalker.currentNode.nodeValue.length;
							if (wrappedLength >= rangeLength) {
								break;
							}
						}
						while (treeWalker.nextNode());
					}
				},
				unwrap: function(elts) {
					elts.cl_each(function(elt) {
						var child = elt.firstChild;
						if (child.nodeType === 3) {
							if (elt.previousSibling && elt.previousSibling.nodeType === 3) {
								child.nodeValue = elt.previousSibling.nodeValue + child.nodeValue;
								elt.parentNode.removeChild(elt.previousSibling);
							}
							if (elt.nextSibling && elt.nextSibling.nodeType === 3) {
								child.nodeValue = child.nodeValue + elt.nextSibling.nodeValue;
								elt.parentNode.removeChild(elt.nextSibling);
							}
						}
						elt.parentNode.insertBefore(child, elt);
						elt.parentNode.removeChild(elt);
					});
				}
			};
		})
	.factory('clDiffUtils',
		function($window) {
			return $window.clDiffUtils;
		})
	.directive('clInfiniteScroll',
		function($timeout) {
			return {
				restrict: 'A',
				link: function(scope, element, attr) {
					var elt = element[0];

					function trigger() {
						if (elt.scrollTop + elt.offsetHeight > elt.scrollHeight - 300) {
							scope.$eval(attr.clInfiniteScroll) && $timeout(trigger);
						}
					}
					elt.addEventListener('scroll', trigger);
					scope.triggerInfiniteScroll = function() {
						$timeout(trigger);
					};
				}
			};
		})
	.directive('clEnterOk',
		function() {
			return {
				restrict: 'A',
				link: function(scope, element) {
					element[0].addEventListener('keydown', function(e) {
						// Check enter key
						if (e.which === 13) {
							e.preventDefault();
							scope.ok();
						}
					});
				}
			};
		})
	.directive('clFocus',
		function() {
			return {
				restrict: 'A',
				link: function(scope, element) {
					scope.focus = function() {
						setTimeout(function() {
							element[0].focus();
						}, 10);
					};
					scope.focus();
				}
			};
		});
