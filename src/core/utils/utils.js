angular.module('classeur.core.utils', [])
	.factory('clConfig',
		function($window) {
			return $window.CL_CONFIG || {};
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
				return mapper.map(function() {
					var result = alphabet[(currentDate + Math.random() * radix) % radix | 0];
					currentDate = Math.floor(currentDate / radix);
					return result;
				}).join('');
			}
			return clUid;
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
				[120, '1 minute ago', '1 minute from now'], // 60*2
				[3600, 'minutes', 60], // 60*60, 60
				[7200, '1 hour ago', '1 hour from now'], // 60*60*2
				[86400, 'hours', 3600], // 60*60*24, 60*60
				[172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
				[604800, 'days', 86400], // 60*60*24*7, 60*60*24
				[1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
				[2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
				[4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
				[29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
				[58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
				[2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
				[5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
				[58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
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
		function($mdToast) {
			var hideDelay = 6000;
			var result = function(text, action, cb) {
				var toast = $mdToast.simple()
					.content(text)
					.action(action)
					.position('bottom right')
					.hideDelay(hideDelay);
				$mdToast.show(toast).then(cb || function() {});
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
				return JSON.stringify(Object.keys(obj).sort().reduce(function(result, key) {
					return (result[key] = obj[key], result);
				}, {}), function(key, value) {
					return key[0] === '$' ? undefined : value;
				});
			}

			function LocalStorageObject(prefix, attrs, globalUpdate) {
				this.$attrHelpers = Object.keys(attrs).reduce(function($attrHelpers, key) {
					var sKey = '$_' + key;
					var defaultValue = attrs[key].default === undefined ? '' : attrs[key].default;
					var serializer = attrs[key].serializer || defaultSerializer;
					var parser = attrs[key].parser || defaultParser;
					return ($attrHelpers[key] = {
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
						write: function() {
							var sValue = serializer(this[key]);
							if (sValue !== this[sKey]) {
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
							}
						},
						check: function() {
							var lsKey = this.$localPrefix + key;
							var sValue = clLocalStorage.getItem(lsKey) || defaultValue;
							return sValue !== this[sKey];
						},
						free: function() {
							this[sKey] = undefined;
							this[key] = undefined;
						}
					}, $attrHelpers);
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
				this.$localPrefix = this.$globalPrefix + (id ? id + '.' : '');
				this.$updateKey = this.$localPrefix + 'u';
				this.$readUpdate();

				function attrOperation(operation) {
					return function() {
						var result;
						Object.keys(this.$attrHelpers).forEach(function(key) {
							result |= this.$attrHelpers[key][operation].call(this);
						}, this);
						return result;
					};
				}
				this.$read = attrOperation('read');
				this.$write = attrOperation('write');
				this.$check = attrOperation('check');
				this.$free = attrOperation('free');
				Object.keys(this.$attrHelpers).forEach(function(key) {
					this.$read[key] = this.$attrHelpers[key].read.bind(this);
					this.$write[key] = this.$attrHelpers[key].write.bind(this);
					this.$check[key] = this.$attrHelpers[key].check.bind(this);
					this.$free[key] = this.$attrHelpers[key].free.bind(this);
				}, this);
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
			Object.keys(clLocalStorage).forEach(function(key) {
				var match = key.match(keyPrefix);
				if (match) {
					var stateAge = parseInt(match[1].split('.')[1] || 0);
					(currentDate - stateAge > stateMaxAge) && clLocalStorage.removeItem(key);
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
				folder: function(folderDao) {
					if (folderDao.id) {
						return '/folders/' + folderDao.id;
					} else {
						return '';
					}
				}
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
					Array.prototype.slice.call(elts).forEach(function(elt) {
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
	.factory('clOffsetUtils',
		function($window) {
			var diffMatchPatch = new $window.diff_match_patch();
			diffMatchPatch.Match_Distance = 999999999;
			var marker = '\uF111\uF222\uF333';
			return {
				offsetToPatch: function(text, offset) {
					var patch = diffMatchPatch.patch_make(text, [
						[0, text.slice(0, offset)],
						[1, marker],
						[0, text.slice(offset)]
					])[0];
					var diffs = patch.diffs.map(function(diff) {
						if (!diff[0]) {
							return diff[1];
						} else if (diff[1] === marker) {
							return '';
						}
					});
					return {
						diffs: diffs,
						length: patch.length1,
						start: patch.start1
					};
				},
				patchToOffset: function(text, patch) {
					var markersLength = 0;
					var diffs = patch.diffs.map(function(diff) {
						if (!diff) {
							markersLength += marker.length;
							return [1, marker];
						} else {
							return [0, diff];
						}
					});
					return diffMatchPatch.patch_apply([{
						diffs: diffs,
						length1: patch.length,
						length2: patch.length + markersLength,
						start1: patch.start,
						start2: patch.start
					}], text)[0].indexOf(marker);
				}
			};
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
	.run(function() {

		var vendors = ['moz', 'webkit'];
		for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
			window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
			window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame'];
		}

		function identity(x) {
			return x;
		}

		function ElementAttribute(name) {
			this.name = name;
			this.setStart = function(animation) {
				var value = animation.elt[name];
				animation.$start[name] = value;
				return value !== undefined && animation.$end[name] !== undefined;
			};
			this.applyCurrent = function(animation) {
				animation.elt[name] = animation.$current[name];
			};
		}

		function StyleAttribute(name, unit, defaultValue, wrap) {
			wrap = wrap || identity;
			this.name = name;
			this.setStart = function(animation) {
				var value = parseFloat(animation.elt.style[name]);
				if (isNaN(value)) {
					value = animation.$current[name] || defaultValue;
				}
				animation.$start[name] = value;
				return animation.$end[name] !== undefined;
			};
			this.applyCurrent = function(animation) {
				animation.elt.style[name] = wrap(animation.$current[name]) + unit;
			};
		}

		function TransformAttribute(name, unit, defaultValue, wrap) {
			wrap = wrap || identity;
			this.name = name;
			this.setStart = function(animation) {
				var value = animation.$current[name];
				if (value === undefined) {
					value = defaultValue;
				}
				animation.$start[name] = value;
				if (animation.$end[name] === undefined) {
					animation.$end[name] = value;
				}
				return value !== undefined;
			};
			this.applyCurrent = function(animation) {
				var value = animation.$current[name];
				return value !== defaultValue && name + '(' + wrap(value) + unit + ')';
			};
		}

		var attributes = [
			new ElementAttribute('scrollTop'),
			new ElementAttribute('scrollLeft'),
			new StyleAttribute('opacity', '', 1),
			new StyleAttribute('zIndex', '', 0),
			new TransformAttribute('translateX', 'px', 0, Math.round),
			new TransformAttribute('translateY', 'px', 0, Math.round),
			new TransformAttribute('scale', '', 1),
			new TransformAttribute('rotate', 'deg', 0),
		].concat([
			'width',
			'height',
			'top',
			'right',
			'bottom',
			'left'
		].map(function(name) {
			return new StyleAttribute(name, 'px', 0, Math.round);
		}));

		function Animation(elt) {
			this.elt = elt;
			this.$current = {};
			this.$pending = {};
		}

		attributes.map(function(attribute) {
			return attribute.name;
		}).concat('duration', 'easing', 'delay').forEach(function(name) {
			Animation.prototype[name] = function(val) {
				this.$pending[name] = val;
				return this;
			};
		});

		Animation.prototype.start = function(endCb, stepCb) {
			var animation = this;
			animation.stop();
			animation.$start = {};
			animation.$end = animation.$pending;
			animation.$pending = {};
			animation.$attributes = attributes.filter(function(attribute) {
				return attribute.setStart(animation);
			});
			animation.$end.duration = animation.$end.duration || 0;
			animation.$end.delay = animation.$end.delay || 0;
			animation.$end.easing = window.BezierEasing.css[animation.$end.easing] || window.BezierEasing.css['ease-out'];
			animation.$end.endCb = typeof endCb === 'function' && endCb;
			animation.$end.stepCb = typeof stepCb === 'function' && stepCb;
			animation.$startTime = Date.now() + animation.$end.delay;
			animationLoop.call(animation, endCb === true);
			return animation.elt;
		};

		Animation.prototype.stop = function() {
			window.cancelAnimationFrame(this.requestId);
		};

		function animationLoop(useTransition) {
			var animation = this;
			var progress = (Date.now() - animation.$startTime) / animation.$end.duration;
			var transition = '';
			if (useTransition && animation.$end.duration) {
				progress = 1;
				var transitions = [
					'all',
					animation.$end.duration + 'ms',
					animation.$end.easing.toCSS()
				];
				animation.$end.delay && transitions.push(animation.$end.delay + 'ms');
				transition = transitions.join(' ');
			} else if (progress < 1) {
				animation.requestId = window.requestAnimationFrame(animationLoop.bind(animation, false));
				if (progress < 0) {
					return;
				}
			} else if (animation.$end.endCb) {
				animation.requestId = window.requestAnimationFrame(animation.$end.endCb);
			}

			var coeff = animation.$end.easing.get(progress);
			var transforms = animation.$attributes.reduce(function(transforms, attribute) {
				if (progress < 1) {
					var diff = animation.$end[attribute.name] - animation.$start[attribute.name];
					animation.$current[attribute.name] = animation.$start[attribute.name] + diff * coeff;
				} else {
					animation.$current[attribute.name] = animation.$end[attribute.name];
				}
				var transform = attribute.applyCurrent(animation);
				return transform && transforms.push(transform), transforms;
			}, []);

			transforms.length && transforms.push('translateZ(1px)'); // activate GPU
			var transform = transforms.join(' ');
			animation.elt.style.WebkitTransform = transform;
			animation.elt.style.MozTransform = transform;
			animation.elt.style.transform = transform;
			animation.elt.style.WebkitTransition = transition;
			animation.elt.style.MozTransition = transition;
			animation.elt.style.transition = transition;
			animation.$end.stepCb && animation.$end.stepCb();
		}

		// Pattern: http://lea.verou.me/2015/04/idea-extending-native-dom-prototypes-without-collisions/
		Object.defineProperty(window.Element.prototype, 'clAnim', {
			get: function() {
				Object.defineProperty(this, 'clAnim', {
					value: new Animation(this)
				});
				return this.clAnim;
			},
			configurable: true,
			writeable: false
		});
	});
